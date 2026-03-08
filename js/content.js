import { round, score } from './score.js';
const dir = '/data';
const defaultPackColour = '#71757a';

function normalizePack(pack) {
    if (typeof pack === 'string') {
        return { name: pack, colour: defaultPackColour };
    }
    if (!pack || typeof pack !== 'object' || !pack.name) {
        return null;
    }
    return {
        ...pack,
        colour: pack.colour || defaultPackColour,
    };
}

function levelHasPack(level, packName) {
    if (!level || !Array.isArray(level.packs)) return false;
    return level.packs.some((pack) => {
        if (typeof pack === 'string') {
            return pack === packName;
        }
        return pack?.name === packName;
    });
}

function attachPackToLevel(level, pack) {
    const normalizedPack = normalizePack(pack) || {
        name: pack?.name || String(pack),
        colour: defaultPackColour,
    };
    const packs = Array.isArray(level?.packs)
        ? level.packs.map((p) => normalizePack(p) || p).filter(Boolean)
        : [];
    const alreadyHasPack = packs.some((p) => p.name === normalizedPack.name);
    if (!alreadyHasPack) packs.push(normalizedPack);

    return {
        ...level,
        packs,
    };
}

async function fetchPackDefinitions() {
    try {
        const result = await fetch(`${dir}/_packs.json`);
        const packs = await result.json();
        if (!Array.isArray(packs)) return null;
        return packs.map(normalizePack).filter(Boolean);
    } catch {
        return null;
    }
}

function buildDemoPacksFromList(list) {
    const validLevels = list
        .filter(([level]) => level?.path)
        .map(([level]) => level);
    const top3Paths = validLevels.slice(0, 3).map((level) => level.path);
    const longest3Paths = [...validLevels]
        .sort((a, b) => (b.path || '').length - (a.path || '').length)
        .slice(0, 3)
        .map((level) => level.path);

    return [
        { name: 'Top 1 Pack', colour: '#1579d6', levels: top3Paths },
        { name: 'Longest Names Pack', colour: '#1fc155', levels: longest3Paths },
    ];
}

export async function fetchList() {
    const listResult = await fetch(`${dir}/_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load list.`);
        return null;
    }
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${dir}/_editors.json`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return null;
    }
}

export async function fetchPacks() {
    const definedPacks = await fetchPackDefinitions();
    if (definedPacks && definedPacks.length > 0) {
        return definedPacks;
    }

    const list = await fetchList();
    if (!list) return null;

    const discovered = new Map();
    list.forEach(([level]) => {
        if (!level || !Array.isArray(level.packs)) return;
        level.packs.forEach((pack) => {
            const normalized = normalizePack(pack);
            if (!normalized) return;
            if (!discovered.has(normalized.name)) {
                discovered.set(normalized.name, normalized);
            }
        });
    });

    const packs = [...discovered.values()];
    if (packs.length > 0) return packs;

    return buildDemoPacksFromList(list);
}

export async function fetchPackLevels(packName) {
    const list = await fetchList();
    if (!list) return [];

    const definedPacks = await fetchPackDefinitions();
    const definedPack = definedPacks?.find((pack) => pack.name === packName);

    if (Array.isArray(definedPack?.levels) && definedPack.levels.length > 0) {
        return definedPack.levels.map((path) => {
            const found =
                list.find(([level]) => level?.path === path) ||
                list.find(([_, err]) => err === path);
            if (!found) return [null, path];

            const [level, err] = found;
            if (!level) return [null, err];
            return [{ level: attachPackToLevel(level, definedPack), records: level.records }, null];
        });
    }

    const byPackTag = list
        .filter(([level]) => levelHasPack(level, packName))
        .map(([level, err]) => {
            if (!level) return [null, err];
            return [{ level: attachPackToLevel(level, definedPack || packName), records: level.records }, null];
        });
    if (byPackTag.length > 0) return byPackTag;

    const demoPack = buildDemoPacksFromList(list).find((p) => p.name === packName);
    if (demoPack && Array.isArray(demoPack.levels) && demoPack.levels.length > 0) {
        return demoPack.levels.map((path) => {
            const found =
                list.find(([level]) => level?.path === path) ||
                list.find(([_, err]) => err === path);
            if (!found) return [null, path];
            const [level, err] = found;
            if (!level) return [null, err];
            return [{ level: attachPackToLevel(level, demoPack), records: level.records }, null];
        });
    }

    return [];
}

export async function fetchLeaderboard() {
    const list = await fetchList();

    const scoreMap = {};
    const errs = [];
    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        const verifierName = level?.verifier || 'Unknown';
        const verifier = Object.keys(scoreMap).find(
            (u) => u.toLowerCase() === verifierName.toLowerCase()
            ) || verifierName;
        scoreMap[verifier] ??= {
            verified: [],
            completed: [],
            progressed: [],
        };
        const { verified } = scoreMap[verifier];
        verified.push({
            rank: rank + 1,
            level: level.name,
            score: score(rank + 1, 100, level.percentToQualify),
            link: level.verification,
        });

        level.records.forEach((record) => {
        const recordUser = record?.user || 'Unknown';
        const user = Object.keys(scoreMap).find(
            (u) => u.toLowerCase() === recordUser.toLowerCase()
        ) || recordUser;
            scoreMap[user] ??= {
                verified: [],
                completed: [],
                progressed: [],
            };
            const { completed, progressed } = scoreMap[user];
            if (record.percent === 100) {
                completed.push({
                    rank: rank + 1,
                    level: level.name,
                    score: score(rank + 1, 100, level.percentToQualify),
                    link: record.link,
                });
                return;
            }

            progressed.push({
                rank: rank + 1,
                level: level.name,
                percent: record.percent,
                score: score(rank + 1, record.percent, level.percentToQualify),
                link: record.link,
            });
        });
    });

    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed } = scores;
        const total = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);

        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    return [res.sort((a, b) => b.total - a.total), errs];
}
