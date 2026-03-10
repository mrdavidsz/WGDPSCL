import { round, score } from './score.js';
const dir = '/data';
const defaultPackColour = '#71757a';
const packColourOverrides = {
    'Top 3 Pack': '#1579d6',
    'Longest Names Pack': '#1fc155',
};

function normalizePack(pack) {
    if (typeof pack === 'string') {
        return { name: pack, colour: packColourOverrides[pack] || defaultPackColour };
    }
    if (!pack || typeof pack !== 'object' || !pack.name) {
        return null;
    }
    return {
        ...pack,
        colour: pack.colour || packColourOverrides[pack.name] || defaultPackColour,
    };
}

function getLevelPacks(level) {
    if (!level) return [];
    if (Array.isArray(level.packs)) {
        return level.packs.map((p) => normalizePack(p)).filter(Boolean);
    }
    if (Array.isArray(level.listpacks)) {
        return level.listpacks.map((p) => normalizePack(p)).filter(Boolean);
    }
    return [];
}

function levelHasPack(level, packName) {
    return getLevelPacks(level).some((pack) => pack.name === packName);
}

function attachPackToLevel(level, pack) {
    const normalizedPack = normalizePack(pack) || {
        name: pack?.name || String(pack),
        colour: defaultPackColour,
    };
    const packs = getLevelPacks(level);
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
        { name: 'Top 3 Pack', colour: '#1579d6', levels: top3Paths },
        { name: 'Longest Names Pack', colour: '#1fc155', levels: longest3Paths },
    ];
}

function levelHasPackName(level, packName) {
    const fromPacks = getLevelPacks(level).some((pack) => pack.name === packName);
    if (fromPacks) return true;
    if (!Array.isArray(level?.listpacks)) return false;
    return level.listpacks.includes(packName);
}

export async function fetchList() {
    const listResult = await fetch(`${dir}/_list.json`);
    try {
        const list = await listResult.json();
        const loaded = await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    const isLegacyPath = path.toUpperCase().includes('(LEGACY)');
                    const cleanName =
                        isLegacyPath && typeof level.name === 'string'
                            ? level.name.replace(/\s*\(LEGACY\)\s*/gi, '').trim()
                            : level.name;
                    return [
                        {
                            ...level,
                            name: cleanName,
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

        const demoPacks = buildDemoPacksFromList(loaded);
        demoPacks.forEach((pack) => {
            pack.levels.forEach((path) => {
                const found = loaded.find(([level]) => level?.path === path);
                const level = found?.[0];
                if (!level) return;
                if (levelHasPackName(level, pack.name)) return;
                level.listpacks = Array.isArray(level.listpacks)
                    ? [...level.listpacks, pack.name]
                    : [pack.name];
            });
        });

        return loaded;
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
        getLevelPacks(level).forEach((normalized) => {
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
    if (!list) return [[], []];

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
            path: level.path,
            score: score(rank + 1, 100, level.percentToQualify),
            link: level.verification,
        });

        level.records.forEach((record) => {
            const recordUser = record?.user || 'Unknown';
            const user = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === recordUser.toLowerCase(),
            ) || recordUser;
            const recordPercent = Number(record.percent);
            scoreMap[user] ??= {
                verified: [],
                completed: [],
                progressed: [],
            };
            const { completed, progressed } = scoreMap[user];
            if (recordPercent >= 100) {
                completed.push({
                    rank: rank + 1,
                    level: level.name,
                    path: level.path,
                    score: score(rank + 1, 100, level.percentToQualify),
                    link: record.link,
                });
                return;
            }

            progressed.push({
                rank: rank + 1,
                level: level.name,
                path: level.path,
                percent: recordPercent,
                score: score(rank + 1, recordPercent, level.percentToQualify),
                link: record.link,
            });
        });
    });

    const packRequirements = new Map();
    const packs = await fetchPacks();
    if (packs?.length) {
        const packLevelsEntries = await Promise.all(
            packs.map(async (pack) => {
                const levels = await fetchPackLevels(pack.name);
                return { pack, levels };
            }),
        );
        packLevelsEntries.forEach(({ pack, levels }) => {
            if (!packRequirements.has(pack.name)) {
                packRequirements.set(pack.name, {
                    name: pack.name,
                    colour: pack.colour || defaultPackColour,
                    levels: new Set(),
                });
            }
            const item = packRequirements.get(pack.name);
            item.colour = pack.colour || item.colour || defaultPackColour;
            levels.forEach(([data]) => {
                const path = data?.level?.path;
                if (path) item.levels.add(path);
            });
        });
    }

    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed } = scores;
        const total = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);
        const completedPaths = new Set(
            [...verified, ...completed, ...progressed.filter((p) => Number(p.percent) >= 100)]
                .map((entry) => entry.path)
                .filter(Boolean),
        );
        const listpacks = [...packRequirements.values()]
            .filter((pack) => {
                if (!pack.levels.size) return false;
                for (const path of pack.levels) {
                    if (completedPaths.has(path)) return true;
                }
                return false;
            })
            .map((pack) => ({ name: pack.name, colour: pack.colour }));

        return {
            user,
            total: round(total),
            listpacks,
            ...scores,
        };
    });

    return [res.sort((a, b) => b.total - a.total), errs];
}
