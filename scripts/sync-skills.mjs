#!/usr/bin/env node
// 技能上游同步工具 —— 检测每个本地技能对应的上游源文件是否更新。
// 只有上游版本（upstreamDir 的最新 commit SHA）变化时才提示，并把上游 diff 暂存供人手动本地化。
// 脚本不调用 AI、不自动改写 skills/。详见 docs/specs/2026-06-24-skill-upstream-sync-spec.md。
//
// 唯一需提交的产物是 state.json（版本记录）。上游原文按 SHA 现抓，不落库。
//
// 用法:
//   node scripts/sync-skills.mjs init [skill]         首次引导:把各技能版本记录为当前上游 HEAD
//   node scripts/sync-skills.mjs check [skill]        检测上游变化（默认命令），暂存 diff，只读 skills/
//   node scripts/sync-skills.mjs accept <skill|--all> 本地化完成后:推进版本号
//   node scripts/sync-skills.mjs status               查看各技能当前记录的版本与待 review 状态
//
// 环境变量: GITHUB_TOKEN（可选）—— 提高 GitHub API 限流额度。

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const execFileP = promisify(execFile);

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const CONFIG_PATH = join(SCRIPT_DIR, 'sync.config.json');
const STATE_PATH = join(SCRIPT_DIR, 'state.json');
const SYNC_DIR = join(SCRIPT_DIR, '.skill-sync'); // 整个目录 gitignore，纯临时
const OLD_DIR = join(SYNC_DIR, 'old');
const NEW_DIR = join(SYNC_DIR, 'incoming');
const DIFF_DIR = join(SYNC_DIR, 'diffs');
const DEVNULL = '/dev/null';

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const paint = (color, s) => `${c[color]}${s}${c.reset}`;
const rel = (p) => (p.startsWith(REPO_ROOT) ? p.slice(REPO_ROOT.length + 1) : p);

async function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, 'utf8'));
}

async function saveState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

function ghHeaders() {
  const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'npc404-skill-sync' };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

// 取 upstreamDir 上最新的一条 commit -> { sha, date }
async function latestCommit(skill) {
  const url = `https://api.github.com/repos/${skill.repo}/commits`
    + `?path=${encodeURIComponent(skill.upstreamDir)}&sha=${encodeURIComponent(skill.branch)}&per_page=1`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    const hint = res.status === 403 && remaining === '0'
      ? '（GitHub API 限流，设置 GITHUB_TOKEN 提额）' : '';
    throw new Error(`查询 commit 失败 ${res.status} ${skill.repo}/${skill.upstreamDir} ${hint}`);
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`上游路径无 commit: ${skill.repo}/${skill.upstreamDir}`);
  }
  return { sha: data[0].sha, date: data[0].commit?.committer?.date ?? '' };
}

// 在指定 commit 抓取单个文件原文（raw 不计入 API 限流）。404 -> null（该版本不含此文件）。
async function fetchRaw(skill, sha, file) {
  const url = `https://raw.githubusercontent.com/${skill.repo}/${sha}/${skill.upstreamDir}/${file}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'npc404-skill-sync' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`抓取原文失败 ${res.status}: ${url}`);
  return await res.text();
}

// 把某 commit 的一组文件落到 dir，返回存在的文件名->本地路径映射（不存在的不写）
async function materialize(dir, skill, sha, files) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const paths = {};
  for (const file of files) {
    const content = await fetchRaw(skill, sha, file);
    if (content === null) continue;
    const target = join(dir, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    paths[file] = target;
  }
  return paths;
}

// git diff --no-index 在有差异时返回 exit code 1，需吞掉
async function gitDiff(a, b) {
  try {
    const { stdout } = await execFileP('git', ['diff', '--no-index', '--', a, b], { maxBuffer: 1024 * 1024 * 32 });
    return stdout;
  } catch (err) {
    if (err.code === 1 && typeof err.stdout === 'string') return err.stdout;
    throw err;
  }
}

function getSkills(config, only) {
  const all = Object.entries(config.skills);
  if (!only || only.startsWith('--')) return all;
  const found = all.filter(([name]) => name === only);
  if (found.length === 0) {
    console.error(paint('red', `未找到技能: ${only}`));
    console.error(`可用: ${all.map(([n]) => n).join(', ')}`);
    process.exit(1);
  }
  return found;
}

async function cmdInit(config, state, only) {
  const skills = getSkills(config, only);
  console.log(paint('bold', `初始化版本记录（${skills.length} 个技能）…\n`));
  for (const [name, skill] of skills) {
    process.stdout.write(`  ${name} … `);
    const { sha, date } = await latestCommit(skill);
    state[name] = { repo: skill.repo, lastCommit: sha, lastSyncedAt: date, pendingCommit: null, pendingDate: null };
    console.log(paint('green', `已记录 ${sha.slice(0, 8)}`));
  }
  await saveState(state);
  console.log(paint('green', `\n完成。版本记录写入 ${rel(STATE_PATH)}（记得提交）。`));
}

async function cmdCheck(config, state, only) {
  const skills = getSkills(config, only);
  await mkdir(DIFF_DIR, { recursive: true });
  const changed = [];
  const fresh = [];
  console.log(paint('bold', `检测上游变化（${skills.length} 个技能）…\n`));

  for (const [name, skill] of skills) {
    const prev = state[name];
    if (!prev || !prev.lastCommit) {
      console.log(`  ${paint('yellow', '∅')} ${name} ${paint('dim', '无版本记录，请先运行 init')}`);
      fresh.push(name);
      continue;
    }
    let latest;
    try {
      latest = await latestCommit(skill);
    } catch (err) {
      console.log(`  ${paint('red', '✗')} ${name} ${paint('red', err.message)}`);
      continue;
    }
    if (latest.sha === prev.lastCommit) {
      console.log(`  ${paint('green', '✓')} ${name} ${paint('dim', `已是最新 ${latest.sha.slice(0, 8)}`)}`);
      continue;
    }

    // 上游变了:按两个 SHA 现抓 old/new，逐文件 diff
    const oldPaths = await materialize(join(OLD_DIR, name), skill, prev.lastCommit, skill.files);
    const newPaths = await materialize(join(NEW_DIR, name), skill, latest.sha, skill.files);
    let diff = '';
    for (const file of skill.files) {
      const a = oldPaths[file] ?? DEVNULL;
      const b = newPaths[file] ?? DEVNULL;
      if (a === DEVNULL && b === DEVNULL) continue;
      diff += await gitDiff(a, b);
    }
    const diffPath = join(DIFF_DIR, `${name}.diff`);
    await writeFile(diffPath, diff);
    await rm(join(OLD_DIR, name), { recursive: true, force: true }); // old 只为 diff，diff 完即弃

    state[name] = { ...prev, pendingCommit: latest.sha, pendingDate: latest.date };
    const ins = (diff.match(/^\+/gm) || []).length;
    const del = (diff.match(/^-/gm) || []).length;
    console.log(`  ${paint('yellow', '●')} ${paint('bold', name)} ${prev.lastCommit.slice(0, 8)} → ${paint('cyan', latest.sha.slice(0, 8))} `
      + `${paint('green', `+${ins}`)} ${paint('red', `-${del}`)} ${paint('dim', rel(diffPath))}`);
    changed.push(name);
  }

  await saveState(state);
  console.log('');
  if (changed.length === 0 && fresh.length === 0) {
    console.log(paint('green', '所有技能均为最新，无需处理。'));
    return;
  }
  if (changed.length > 0) {
    console.log(paint('bold', `${changed.length} 个技能上游有更新，待本地化:`));
    console.log(paint('dim', `  1. 看 diff: ${rel(DIFF_DIR)}/<skill>.diff，最新原文在 ${rel(NEW_DIR)}/<skill>/`));
    console.log(paint('dim', `  2. 对照本地 ${rel(join(REPO_ROOT, 'skills'))}/<skill>/，把上游变更重新本地化写回`));
    console.log(paint('dim', `  3. 完成后运行: node scripts/sync-skills.mjs accept ${changed.length === 1 ? changed[0] : '--all'}`));
  }
  if (fresh.length > 0) {
    console.log(paint('yellow', `${fresh.length} 个技能尚无版本记录，请先运行: node scripts/sync-skills.mjs init`));
  }
}

async function cmdAccept(config, state, only) {
  if (!only) {
    console.error(paint('red', '用法: accept <skill> 或 accept --all'));
    process.exit(1);
  }
  const targets = only === '--all'
    ? Object.keys(config.skills).filter((n) => state[n]?.pendingCommit)
    : [only];
  if (targets.length === 0) {
    console.log(paint('yellow', '没有待 accept 的技能（先运行 check）。'));
    return;
  }
  for (const name of targets) {
    const st = state[name];
    if (!st?.pendingCommit) {
      console.log(`  ${paint('yellow', '∅')} ${name} ${paint('dim', '无待 accept 的变更，跳过')}`);
      continue;
    }
    state[name] = {
      ...st,
      lastCommit: st.pendingCommit,
      lastSyncedAt: st.pendingDate || new Date().toISOString(),
      pendingCommit: null,
      pendingDate: null,
    };
    await rm(join(DIFF_DIR, `${name}.diff`), { force: true });
    await rm(join(NEW_DIR, name), { recursive: true, force: true });
    console.log(`  ${paint('green', '✓')} ${name} ${paint('dim', '版本推进至')} ${paint('cyan', state[name].lastCommit.slice(0, 8))}`);
  }
  await saveState(state);
  console.log(paint('green', '\n已更新版本记录，记得提交 state.json。'));
}

async function cmdStatus(config, state) {
  console.log(paint('bold', '技能版本状态:\n'));
  for (const name of Object.keys(config.skills)) {
    const st = state[name];
    if (!st?.lastCommit) {
      console.log(`  ${paint('yellow', '∅')} ${name.padEnd(24)} ${paint('dim', '未初始化')}`);
      continue;
    }
    const pending = st.pendingCommit
      ? paint('yellow', ` ● 待 accept → ${st.pendingCommit.slice(0, 8)}`)
      : paint('green', ' ✓');
    const when = st.lastSyncedAt ? paint('dim', st.lastSyncedAt.slice(0, 10)) : '';
    console.log(`  ${name.padEnd(24)} ${paint('cyan', st.lastCommit.slice(0, 8))} ${when}${pending}`);
  }
}

async function main() {
  const [, , cmd = 'check', arg] = process.argv;
  const config = await loadJson(CONFIG_PATH, null);
  if (!config) {
    console.error(paint('red', `缺少配置文件: ${rel(CONFIG_PATH)}`));
    process.exit(1);
  }
  const state = await loadJson(STATE_PATH, {});

  switch (cmd) {
    case 'init': return cmdInit(config, state, arg);
    case 'check': return cmdCheck(config, state, arg);
    case 'accept': return cmdAccept(config, state, arg);
    case 'status': return cmdStatus(config, state);
    case '-h': case '--help': case 'help':
      console.log([
        '技能上游同步工具',
        '',
        '  node scripts/sync-skills.mjs init [skill]         首次引导，记录当前上游版本',
        '  node scripts/sync-skills.mjs check [skill]        检测上游变化（默认），暂存 diff',
        '  node scripts/sync-skills.mjs accept <skill|--all> 本地化完成后推进版本号',
        '  node scripts/sync-skills.mjs status               查看各技能版本与待办状态',
        '',
        '环境变量 GITHUB_TOKEN（可选）提高 API 限流额度。',
      ].join('\n'));
      return;
    default:
      console.error(paint('red', `未知命令: ${cmd}（试试 --help）`));
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(paint('red', `\n出错: ${err.message}`));
  process.exit(1);
});
