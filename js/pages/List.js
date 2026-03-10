import { store } from "../main.js";
import { embed } from "../util.js";
import { score } from "../score.js";
import { fetchEditors, fetchList } from "../content.js";

import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

const roleIconMap = {
    owner: "crown",
    admin: "user-gear",
    helper: "user-shield",
    dev: "code",
    trial: "user-lock",
};

const listPackColours = {
    "Top 3 Pack": "#1579d6",
    "Longest Names Pack": "#1fc155",
};

function getFirstPackTag(level) {
    const fromPacks = level?.packs?.[0];
    if (typeof fromPacks === "string") return { name: fromPacks, colour: null };
    if (fromPacks?.name) return { name: fromPacks.name, colour: fromPacks.colour || null };

    if (Array.isArray(level?.listpacks) && typeof level.listpacks[0] === "string") {
        return { name: level.listpacks[0], colour: null };
    }
    if (typeof level?.listpacks === "string") {
        return { name: level.listpacks, colour: null };
    }
    if (typeof level?.listpack === "string") {
        return { name: level.listpack, colour: null };
    }
    return { name: "", colour: null };
}

export default {
    components: { Spinner, LevelAuthors },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list">
            <div class="list-container">
                <div class="tabs list-tabs">
                    <button
                        class="tab type-label-lg"
                        :class="{ selected: activeSection === 'levels' }"
                        @click="activeSection = 'levels'"
                    >
                        Levels
                    </button>
                    <button
                        class="tab type-label-lg"
                        :class="{ selected: activeSection === 'legacy' }"
                        @click="activeSection = 'legacy'"
                    >
                        Legacy Levels
                    </button>
                </div>
                <input
                    v-model.trim="searchQuery"
                    class="list-search type-label-lg"
                    type="text"
                    placeholder="Search levels..."
                />
                <table class="list" v-if="list">
                    <tr v-for="item in filteredList" :key="item.i">
                        <td class="rank">
                            <p class="type-label-lg" v-if="activeSection === 'legacy'">Legacy</p>
                            <p class="type-label-lg" v-else>#{{ item.i + 1 }}</p>
                        </td>
                        <td class="level" :class="{ 'active': selected == item.i, 'error': !item.level }">
                            <button @click="selected = item.i">
                                <span class="type-label-lg">{{ displayLevelName(item.level, item.err) }}</span>
                            </button>
                        </td>
                    </tr>
                </table>
                <p v-if="list && filteredList.length === 0" class="type-label-lg">No levels found.</p>
            </div>
            <div class="level-container">
                <div class="level" v-if="level">
                    <h1>{{ level.name }}</h1>
                    <LevelAuthors :author="level.author" :creators="level.creators" :verifier="level.verifier"></LevelAuthors>
                    <div
                        v-if="displayPackName"
                        class="tag level-pack-pill"
                        :style="{ background: displayPackColour, color: '#fff' }"
                    >
                        {{ displayPackName }}
                    </div>
                    <iframe class="video" id="videoframe" :src="video" frameborder="0"></iframe>
                    <ul class="stats">
                        <li>
                            <div class="type-title-sm">Points when completed</div>
                            <p>{{ score(selected + 1, 100, level.percentToQualify) }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">ID</div>
                            <p>{{ level.id }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">Password</div>
                            <p>{{ level.password || 'Free to Copy' }}</p>
                        </li>
                    </ul>
                    <h2>Records</h2>
                    <p v-if="selected + 1 <= 75"><strong>{{ level.percentToQualify }}%</strong> or better to qualify</p>
                    <p v-else-if="selected +1 <= 150"><strong>100%</strong> or better to qualify</p>
                    <p v-else>This level does not accept new records.</p>
                    <table class="records">
                        <tr v-for="record in level.records" class="record">
                            <td class="percent">
                                <p>{{ record.percent }}%</p>
                            </td>
                            <td class="user">
                                <a :href="record.link" target="_blank" class="type-label-lg">{{ record.user }}</a>
                            </td>
                            <td class="mobile">
                                <img v-if="record.mobile" :src="\`/assets/phone-landscape\${store.dark ? '-dark' : ''}.svg\`" alt="Mobile">
                            </td>
                            <td class="hz">
                                <p>{{ record.hz }}Hz</p>
                            </td>
                        </tr>
                    </table>
                </div>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>(ノಠ益ಠ)ノ彡┻━┻</p>
                </div>
            </div>
            <div class="meta-container">
                <div class="meta">
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors">{{ error }}</p>
                    </div>
                    <div class="og">
                        <p class="type-label-md">Website layout made by <a href="https://tsl.pages.dev/" target="_blank">TheShittyList</a></p>
                    </div>
                    <template v-if="editors">
                        <h3>List Editors</h3>
                        <ol class="editors">
                            <li v-for="editor in editors">
                                <img :src="\`/assets/\${roleIconMap[editor.role]}\${store.dark ? '-dark' : ''}.svg\`" :alt="editor.role">
                                <a v-if="editor.link" class="type-label-lg link" target="_blank" :href="editor.link">{{ editor.name }}</a>
                                <p v-else>{{ editor.name }}</p>
                            </li>
                        </ol>
                    </template>
                    <h3>Submission Requirements</h3>
                    <p>
                        Achieved the record without using hacks (however, FPS bypass is allowed, up to 360fps)
                    </p>
                    <p>
                        Achieved the record on the level that is listed on the site - please check the level ID before you submit a record
                    </p>
                    <p>
                        Have either source audio or clicks/taps in the video. Edited audio only does not count
                    </p>
                    <p>
                        The recording must have a previous attempt and entire death animation shown before the completion, unless the completion is on the first attempt. Everyplay records are exempt from this
                    </p>
                    <p>
                        The recording must also show the player hit the endwall, or the completion will be invalidated.
                    </p>
                    <p>
                        Do not use secret routes or bug routes
                    </p>
                    <p>
                        Do not use easy modes, only a record of the unmodified level qualifies
                    </p>
                    <p>
                        Once a level falls onto the Legacy List, we accept records for it for 24 hours after it falls off, then afterwards we never accept records for said level
                    </p>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        list: [],
        editors: [],
        searchQuery: "",
        activeSection: "levels",
        loading: true,
        selected: 0,
        errors: [],
        roleIconMap,
        store
    }),
    computed: {
        level() {
            return this.list[this.selected][0];
        },
        video() {
            if (!this.level.showcase) {
                return embed(this.level.verification);
            }

            return embed(
                this.toggledShowcase
                    ? this.level.showcase
                    : this.level.verification
            );
        },
        displayPackName() {
            const direct = getFirstPackTag(this.level).name;
            if (direct) return direct;

            if (this.selected <= 2) return "Top 3 Pack";

            const longestIndexes = this.list
                .map(([level], i) => ({ i, len: (level?.path || "").length }))
                .sort((a, b) => b.len - a.len)
                .slice(0, 3)
                .map((item) => item.i);
            if (longestIndexes.includes(this.selected)) return "Longest Names Pack";

            return "";
        },
        displayPackColour() {
            const tag = getFirstPackTag(this.level);
            if (tag.colour) return tag.colour;
            if (tag.name && listPackColours[tag.name]) {
                return listPackColours[tag.name];
            }
            return "#3f51b5";
        },
        filteredList() {
            const query = this.searchQuery.toLowerCase();
            return this.list
                .map(([level, err], i) => ({ level, err, i }))
                .filter((item) => {
                    const path = item.level?.path || item.err || "";
                    const isLegacy = path.includes("(LEGACY)");
                    if (this.activeSection === "legacy" && !isLegacy) return false;
                    if (this.activeSection === "levels" && isLegacy) return false;
                    if (!query) return true;
                    const name = item.level?.name || item.err || "";
                    return name.toLowerCase().includes(query);
                });
        },
    },
    watch: {
        filteredList(newList) {
            if (!newList.length) return;
            if (!newList.some((item) => item.i === this.selected)) {
                this.selected = newList[0].i;
            }
        },
    },
    async mounted() {
        // Hide loading spinner
        this.list = await fetchList();
        this.editors = await fetchEditors();

        // Error handling
        if (!this.list) {
            this.errors = [
                "Failed to load list. Retry in a few minutes or notify list staff.",
            ];
        } else {
            this.errors.push(
                ...this.list
                    .filter(([_, err]) => err)
                    .map(([_, err]) => {
                        return `Failed to load level. (${err}.json)`;
                    })
            );
            if (!this.editors) {
                this.errors.push("Failed to load list editors.");
            }
        }

        this.loading = false;
    },
    methods: {
        embed,
        score,
        displayLevelName(level, err) {
            const raw = level?.name || `Error (${err}.json)`;
            return raw.replace(/\s*\(LEGACY\)\s*/gi, "").trim();
        },
    },
};
