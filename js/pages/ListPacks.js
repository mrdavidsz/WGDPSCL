import { store } from '../main.js';
import { fetchPacks, fetchPackLevels } from '../content.js';
import { embed } from '../util.js';
import { score } from '../score.js';

import Spinner from '../components/Spinner.js';
import LevelAuthors from '../components/List/LevelAuthors.js';

const listPackColours = {
    'Top 3 Pack': '#1579d6',
    'Longest Names Pack': '#1fc155',
};

function getFirstPackTag(level) {
    const fromPacks = level?.packs?.[0];
    if (typeof fromPacks === 'string') return { name: fromPacks, colour: null };
    if (fromPacks?.name) return { name: fromPacks.name, colour: fromPacks.colour || null };

    if (Array.isArray(level?.listpacks) && typeof level.listpacks[0] === 'string') {
        return { name: level.listpacks[0], colour: null };
    }
    if (typeof level?.listpacks === 'string') {
        return { name: level.listpacks, colour: null };
    }
    if (typeof level?.listpack === 'string') {
        return { name: level.listpack, colour: null };
    }
    return { name: '', colour: null };
}

export default {
    components: {
        Spinner,
        LevelAuthors,
    },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="pack-list">
            <div class="packs-nav">
                <div>
                    <button @click="switchLevels(i)" v-for="(pack, i) in packs" :key="pack.name" :style="{background: pack.colour}" class="type-label-lg">
                        <p :style="{color:'#fff'}">{{pack.name}}</p>
                    </button>
                </div>
            </div>
            <div class="list-container">
                <table class="list" v-if="selectedPackLevels">
                    <tr v-for="(level, i) in selectedPackLevels" :key="i">
                        <td class="rank">
                            <p class="type-label-lg">#{{ i + 1 }}</p>
                        </td>
                        <td class="level" :class="{ 'active': selectedLevel == i, 'error': !level[0] }">
                            <button :style="[selectedLevel == i ? {background: pack.colour, color: '#fff'} : {}]" @click="selectedLevel = i">
                                <span class="type-label-lg">{{ level[0]?.level.name || \`Error (\${level[1]}.json)\` }}</span>
                            </button>
                        </td>
                    </tr>
                </table>
            </div>
            <div class="level-container">
                <div class="level" v-if="currentLevelData">
                    <h1>
                        <img :src="getLevelEmoji(level)" class="difficultyface" v-if="level"/>{{ level?.name }}
                    </h1>
                    <div
                        v-if="displayPackName"
                        class="tag level-pack-pill"
                        :style="{background: displayPackColour, color:'#fff'}"
                    >
                        {{ displayPackName }}
                    </div>
                    <LevelAuthors :author="level?.author" :creators="level?.creators || []" :creators0="level?.creators0" :verifier="level?.verifier"></LevelAuthors>
                    <div v-if="level?.showcase" class="tabs">
                        <button class="tab type-label-lg" :class="{selected: !toggledShowcase}" @click="toggledShowcase = false">
                            <span class="type-label-lg">Verification</span>
                        </button>
                        <button class="tab type-label-lg" :class="{selected: toggledShowcase}" @click="toggledShowcase = true">
                            <span class="type-label-lg">Showcase</span>
                        </button>
                    </div>
                    <iframe class="video" :src="video" frameborder="0"></iframe>
                    <ul class="stats">
                        <li>
                            <div class="type-title-sm">ID</div>
                            <p>{{ level?.id }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">Password</div>
                            <p>{{ level?.password || 'Free to Copy' }}</p>
                        </li>
                    </ul>
                    <h2>Records</h2>
                    <table class="records" v-if="currentLevelData?.records?.length > 0">
                        <tr v-for="record in currentLevelData.records" :key="record.link" class="record">
                            <td class="link">
                                <a :href="record.link" target="_blank" class="type-label-lg">Video</a>
                            </td>
                            <td class="user">
                                <a :href="record.link" target="_blank" class="type-label-lg">{{ record.user }}</a>
                            </td>
                            <td class="mobile">
                                <img v-if="record.mobile" :src="\`/assets/phone-landscape\${store?.dark ? '-dark' : ''}.svg\`" alt="Mobile">
                            </td>
                        </tr>
                    </table>
                </div>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>(No level selected)</p>
                </div>
            </div>
            <div class="meta-container">
                <div class="meta">
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors" :key="error">{{ error }}</p>
                    </div>
                    <h3>About the packs</h3>
                    <p>
                        These are list packs all chosen by the WGDPSCL List Dev team that you can beat levels for and get the packs attached to your profile.
                    </p>
                    <h3>How can I get these packs?</h3>
                    <p>
                        You get packs by beating all levels that are under them.
                    </p>
                    <p>Thanks to KrisGra & TSL for helping to make the packs function</p>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        store,
        packs: [],
        errors: [],
        selected: 0,
        selectedLevel: 0,
        selectedPackLevels: [],
        loading: true,
        loadingPack: true,
        toggledShowcase: false,
    }),
    computed: {
        pack() {
            return this.packs[this.selected];
        },
        currentLevelData() {
            if (
                this.selectedPackLevels &&
                this.selectedPackLevels.length > this.selectedLevel &&
                this.selectedPackLevels[this.selectedLevel]
            ) {
                return this.selectedPackLevels[this.selectedLevel][0];
            }
            return null;
        },
        level() {
            return this.currentLevelData?.level;
        },
        displayPackName() {
            return getFirstPackTag(this.level).name;
        },
        displayPackColour() {
            const tag = getFirstPackTag(this.level);
            if (tag.colour) return tag.colour;
            if (tag.name && listPackColours[tag.name]) {
                return listPackColours[tag.name];
            }
            return '#71757a';
        },
        video() {
            if (!this.level) return '';

            if (!this.level.showcase) {
                return embed(this.level.verification);
            }
            return embed(
                this.toggledShowcase
                    ? this.level.showcase
                    : this.level.verification,
            );
        },
    },
    async mounted() {
        this.packs = await fetchPacks();

        if (!this.packs || this.packs.length === 0) {
            this.errors = [
                'Failed to load pack list. Retry in a few minutes or notify list staff.',
            ];
            this.loading = false;
            return;
        }

        this.selectedPackLevels = await fetchPackLevels(
            this.packs[this.selected].name,
        );

        this.errors.push(
            ...this.selectedPackLevels
                .filter(([_, err]) => err)
                .map(([_, err]) => {
                    return `Failed to load level. (${err}.json)`;
                }),
        );

        this.loading = false;
        this.loadingPack = false;
    },
    methods: {
        async switchLevels(i) {
            this.loadingPack = true;

            this.selected = i;
            this.selectedLevel = 0;
            this.selectedPackLevels = await fetchPackLevels(
                this.packs[this.selected].name,
            );

            this.errors.length = 0;
            this.errors.push(
                ...this.selectedPackLevels
                    .filter(([_, err]) => err)
                    .map(([_, err]) => {
                        return `Failed to load level. (${err}.json)`;
                    }),
            );
            this.loadingPack = false;
        },
        score,
        embed,
        getLevelEmoji(level) {
            const value = level?.emoji;
            if (!value) return '/assets/demonfaces/extreme2.png';
            if (typeof value !== 'string') return '/assets/demonfaces/extreme2.png';
            if (value.startsWith('/')) return value;
            return `/assets/demonfaces/${value}.png`;
        },
        getDemonRating() {
            const currentLevel = this.level;

            if (
                !currentLevel ||
                typeof currentLevel.difficulty !== 'number' ||
                !currentLevel.rating
            ) {
                return '/assets/demonfaces/default.png';
            }

            const difficultyNames = ['easy', 'medium', 'hard', 'insane', 'extreme'];
            if (
                currentLevel.difficulty < 0 ||
                currentLevel.difficulty >= difficultyNames.length
            ) {
                return '/assets/demonfaces/default.png';
            }
            const difficultyPrefix = difficultyNames[currentLevel.difficulty];
            const ratingSuffix = currentLevel.rating;

            const demonFaceFileName = difficultyPrefix + ratingSuffix;
            return `/assets/demonfaces/${demonFaceFileName}.png`;
        },
    },
};
