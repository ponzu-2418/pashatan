const SERVER = ""

function getUserId() {
    try {
        let id = localStorage.getItem("pashatan-user-id");
        if (!id) {
            id = "u-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
            localStorage.setItem("pashatan-user-id", id);
        }
        return id;
    } catch (error) {
        return "u-" + Math.random().toString(36).slice(2, 10);
    }
}

function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}), "X-User-Id": USER_ID };
    return fetch(SERVER + path, { ...options, headers: headers });
}

const USER_ID = getUserId();


/* ==========================
   スタンプカード
========================== */

const STAMP_KEY = "pashatan-stamps-" + USER_ID;

// 今日の日付を YYYY-MM-DD 形式で取得
function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// 日付を日数計算用の数値に変換
function dateToDayNumber(date) {
    const [year, month, day] = date.split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

// スタンプデータを読み込む
function loadStampData() {
    const saved = localStorage.getItem(STAMP_KEY);

    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (
                typeof data.startDate === "string" &&
                Array.isArray(data.stamps)
            ) {
                return data;
            }
        } catch (error) {
            console.error("スタンプデータの読み込み失敗", error);
        }
    }

    // 初回利用時
    const data = {
        startDate: getToday(),
        stamps: []
    };

    localStorage.setItem(STAMP_KEY, JSON.stringify(data));
    return data;
}

// スタンプを保存
function saveStampData(data) {
    localStorage.setItem(STAMP_KEY, JSON.stringify(data));
}

// 今日のスタンプを付与
function addStamp() {
    const data = loadStampData();
    const today = getToday();

    // 同じ日に2回押さない
    if (data.stamps.includes(today)) {
        return;
    }

    data.stamps.push(today);
    saveStampData(data);

    renderStampCard();
}

// 連続撮影日数を計算
function calculateStreak(stamps) {
    const stampSet = new Set(stamps);
    const todayNumber = dateToDayNumber(getToday());

    // 今日未撮影なら昨日から数える
    let currentDay = stampSet.has(getToday())
        ? todayNumber
        : todayNumber - 1;

    let streak = 0;

    while (true) {
        const date = new Date(currentDay * 86400000)
            .toISOString().slice(0, 10);

        if (!stampSet.has(date)) {
            break;
        }

        streak++;
        currentDay--;
    }

    return streak;
}

// スタンプカードを表示
function renderStampCard() {
    const data = loadStampData();
    const list = document.getElementById("stamp-list");
    const streakElement = document.getElementById("stamp-streak");

    if (!list || !streakElement) {
        return;
    }

    list.innerHTML = "";

    const today = getToday();
    const startNumber = dateToDayNumber(data.startDate);
    const todayNumber = dateToDayNumber(today);

    // 初回利用日から何日目か
    const currentDay = Math.max(1, todayNumber - startNumber + 1);

    // 7日単位の表示範囲
    const page = Math.floor((currentDay - 1) / 7);
    const firstDay = page * 7 + 1;

    const stampSet = new Set(data.stamps);

    for (let i = 0; i < 7; i++) {
        const dayNumber = firstDay + i;
        const dayValue = startNumber + dayNumber - 1;

        const date = new Date(dayValue * 86400000)
            .toISOString().slice(0, 10);

        const completed = stampSet.has(date);
        const isToday = date === today;

        // 1日分の要素
        const day = document.createElement("div");
        day.className = "stamp-day";

        if (completed) {
            day.classList.add("completed");
        } else if (isToday) {
            day.classList.add("today");
        }

        // スタンプ枠
        const slot = document.createElement("div");
        slot.className = "stamp-slot";

        if (completed) {
            slot.textContent = "パシャ";
        } else if (isToday) {
            slot.textContent = "きょう";
        }

        // 日数ラベル
        const label = document.createElement("span");
        label.className = "stamp-day-label";
        label.textContent = `${dayNumber}日目`;

        day.append(slot, label);
        list.append(day);
    }

    // 連続日数を表示
    const streak = calculateStreak(data.stamps);
    streakElement.textContent = `連続${streak}日`;
}

// 初回表示
renderStampCard();


function showScreen(id){
    const screens = document.querySelectorAll(".screen");
    screens.forEach((screen) => {
        screen.classList.remove("active");
    });
    document.getElementById(id).classList.add("active");

    // ホーム画面に戻ったときに更新
    if (id === "screen-title") {
        renderStampCard();
    }
}

function showQuestion(quiz){
    document.getElementById("quiz1").textContent = quiz.choices[0];
    document.getElementById("quiz2").textContent = quiz.choices[1];
    document.getElementById("quiz3").textContent = quiz.choices[2];
    document.getElementById("quiz4").textContent = quiz.choices[3];
    quizButtons.forEach((b) => {
        b.disabled = false;
    });
    showScreen("screen-quiz");
}

let quizId = null;
let isReview = false;
let reviewRemaining = 0;
let allWords = [];
let currentCategory = "すべて";

async function createQuiz(file){
    try{
        const form = new FormData();
        form.append("image",file);
        const res = await apiFetch("/quiz", {
            method: "POST",
            body: form
    });
    if (!res.ok){
        throw new Error("サーバーに断られました");
    }
    const quiz = await res.json();
    quizId = quiz.quiz_id;
    // クイズ生成に成功したらスタンプを付与
    try {
        addStamp();
    } catch (error) {
        console.error("スタンプの保存に失敗しました", error);
    }
    showQuestion(quiz);
    }catch(error){
        console.error(error);
        showError("うまくいきませんでした。\nもう一度撮ってね。");
    }
}

async function startReview(){
    isReview = true;
    try{
        const res = await apiFetch("/review");
        if(!res.ok){
            throw new Error("サーバーに断られました");
        }
        const quiz = await res.json();

        if (quiz.quiz_id == null){
            isReview = false;
            showScreen("screen-record");
            loadStats();
            await loadWords();
            document.getElementById("word-count").textContent="復習完了!　よく頑張ったね";
            return;
        }

        quizId = quiz.quiz_id;
        reviewRemaining = quiz.remaining;
        photo.src = SERVER + quiz.image_url;
        showQuestion(quiz);
    }catch(error){
        console.error(error);
        showError("復習の問題を作れませんでした。");
    }
}
function showResult(result){
    if(result.correct){
        document.getElementById("correct").textContent = "正解！";
        playSfx("sfx-correct");
    }else{
        document.getElementById("correct").textContent = "不正解！";
        playSfx("sfx-wrong");
    }
    document.getElementById("word").textContent = result.answer;
    document.getElementById("japanese").textContent = result.japanese;
    document.getElementById("explan").textContent = result.explanation;
    document.getElementById("category").textContent = result.category;
    document.getElementById("related").textContent = result.related;
    let left = reviewRemaining;
    if(result.correct){
        left = left- 1;
    }
    const hasNext = isReview && left >0;
    document.getElementById("next-review").hidden = !hasNext;
    document.getElementById("retake").hidden = hasNext;
    showScreen("screen-result");
}

async function sendAnswer(choice){
    try {
        const res = await apiFetch("/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quiz_id: quizId, choice: choice })
        });
        if (!res.ok) {
            throw new Error("サーバーに断られました");
        }
        const result = await res.json();
            // 復習問題に回答したらスタンプを付与
        if (isReview) {
            try {
            addStamp();
            } catch (error) {
                console.error("スタンプの保存に失敗しました", error);
            }
        }
        showResult(result);
    } catch (error) {
        console.error(error);
        showError("答え合わせに失敗しました。\nもう一度撮ってね。");
    }
}

function showError(message){
    showScreen("screen-title");
    errorText.textContent = message;
}

function speak(word) {
    const voice = new SpeechSynthesisUtterance(word);
    voice.lang = "en-Us";
    speechSynthesis.speak(voice);
}

function playSfx(id){
    const sound = document.getElementById(id);
    sound.currentTime = 0;
    sound.play();
}

async function loadStats(){
    try{
        const res = await apiFetch("/stats");
        if(!res.ok){
            throw new Error("サーバーに断られました");
        }
        const stats=await res.json();
        document.getElementById("record-day").textContent = "連続" + stats.streak + "日";
        document.getElementById("answer-rate").textContent = "正答率" + Math.round(stats.accuracy * 100)+"%";
        
    }catch(error){
        console.error(error);
        showError("記録を読み込めませんでした。");
    }
}

async function loadWords(){
     try {
        const res = await apiFetch("/words");
        if (!res.ok) {
            throw new Error("サーバーに断られました");
        }
        const words = await res.json();
        document.getElementById("word-count").textContent = words.length + "個の単語を集めたよ";
        words.sort((a,b) => (a.category || "その他").localeCompare(b.category || "その他"));
        allWords = words;
        renderFilter();
        renderWords();
    } catch (error) {
        console.error(error);
        showError("単語帳を読み込めませんでした。");
    }
}

function showWordDetail(w){
    document.getElementById("detail-photo").src = SERVER + w.image_url;
    document.getElementById("detail-en").textContent = w.word;
    document.getElementById("detail-ja").textContent = w.japanese;
    document.getElementById("detail-explan").textContent = w.explanation || "解説はまだありません";
    document.getElementById("detail-category").textContent = w.category || "-";
    document.getElementById("detail-related").textContent = w.related || "-";
    showScreen("screen-word");
}

function renderFilter(){
    const filter = document.getElementById("filterbox");
    filter.innerHTML = "";

    const categories = ["すべて", ...new Set(allWords.map((w) => w.category || "その他"))];
        categories.forEach((cat) => {
        let count = allWords.length;
        if (cat !== "すべて") {
            count = allWords.filter((w) => (w.category || "その他") === cat).length;
        }

        const btn = document.createElement("button");
        btn.className = cat === currentCategory ? "chip active" : "chip";
        btn.textContent = cat;

        const num = document.createElement("span");
        num.className = "chip-count";
        num.textContent = count;
        btn.append(num);

        btn.addEventListener("click", () => {
            currentCategory = cat;
            renderFilter();
            renderWords();
        });

        filter.append(btn);
    });
}

function renderWords(){
    let words = allWords;
    if(currentCategory != "すべて"){
        words = allWords.filter((w) => (w.category || "その他") === currentCategory);
    }

    const list = document.getElementById("record-list");
    list.innerHTML = "";

    

    let lastCategory = null;

    words.forEach((w) => {
        const category = w.category || "その他";
        if(category !== lastCategory){
            const heading = document.createElement("li");
            heading.className = "category-heading";
            heading.textContent = category;
            list.append(heading);
            lastCategory = category;
        }

        const mark = document.createElement("span");
        if(w.last_correct){
            mark.className = "mark ok";
            mark.textContent = "〇";
        }else{
            mark.className = "mark ng";
            mark.textContent = "×";
        }
        const img = document.createElement("img");
        img.className = "word-photo";
        img.src = SERVER + w.image_url;
        img.alt = w.word;
        const en = document.createElement("p");
        en.className = "word-en";
        en.textContent = w.word;

        const ja = document.createElement("p");
        ja.className= "word-ja"
        ja.textContent = w.japanese;

        const text = document.createElement("div");
        text.className ="word-text";
        text.append(en,ja);

        const li = document.createElement("li");
        li.className = "word-item";
        li.append(mark,img,text);
        li.addEventListener("click", () => {
            showWordDetail(w);
        });
        list.append(li);
    });
}
console.log("パシャ単を起動しました");
const recordButton = document.getElementById("record");
const errorText = document.getElementById("error");

recordButton.addEventListener("click" , () =>{
    currentCategory = "すべて";
    showScreen("screen-record");
    loadStats();
    loadWords();
});

const titleScreen = document.getElementById("screen-title");
const recordScreen= document.getElementById("screen-record");
const titleButtons = document.querySelectorAll(".title");

titleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        showScreen("screen-title");
    });
});

const photoInput = document.getElementById("photo-input");
const photo = document.getElementById("photo");

photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    isReview = false;
    photoInput.value = "";
    errorText.textContent="";
    photo.src = URL.createObjectURL(file);
    showScreen("screen-judge");
    createQuiz(file);     
})

const quizButtons = document.querySelectorAll(".quiz");

quizButtons.forEach((button) => {
    button.addEventListener("click", () => {
        quizButtons.forEach((b) => {
        b.disabled = true;
        });
        sendAnswer(button.textContent);
    });
})

let lastTouchEnd = 0;

document.addEventListener("touchend", (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

const backRecordButton = document.getElementById("back-record");

backRecordButton.addEventListener("click" , () => {
    showScreen("screen-record");
});

document.getElementById("review").addEventListener("click", () => {
    showScreen("screen-judge");
    startReview();
});

document.getElementById("next-review").addEventListener("click", ()=> {
    showScreen("screen-judge");
    startReview();
})

document.getElementById("speak-result").addEventListener("click", () =>{
    speak(document.getElementById("word").textContent);
});

document.getElementById("speak-detail").addEventListener("click", () =>{
    speak(document.getElementById("detail-en").textContent);
});

document.addEventListener("click", () => {
    ["sfx-correct", "sfx-wrong"].forEach((id) => {
        const sound = document.getElementById(id);
        sound.muted = true;
        sound.play().then(() => {
            sound.pause();
            sound.currentTime = 0;
            sound.muted = false;
        }).catch(() => {
            sound.muted = false;
        });
    });
}, { once: true });

/* ==========================
   図鑑機能：ここから追加
========================== */

// 図鑑のデータと表示状態
let zukanData = [];
let selectedZukanCategory = null;
let zukanFilter = "all";
let zukanRequestId = 0;

// HTMLの表示先
const zukanCategories = document.getElementById(
    "encyclopedia-categories"
);

const zukanWordList = document.getElementById(
    "category-word-list"
);

const zukanTabs = document.querySelectorAll(
    ".category-tab"
);


/* --------------------------
   案内メッセージ
-------------------------- */

function showZukanMessage(container, message) {
    container.replaceChildren();

    const text = document.createElement("p");
    text.className = "zukan-message";
    text.textContent = message;

    container.append(text);
}


/* --------------------------
   図鑑を開く・APIから取得
-------------------------- */

async function openZukan() {
    const requestId = ++zukanRequestId;

    showScreen("screen-encyclopedia");

    document.getElementById("encyclopedia-total").textContent =
        "読み込み中";

    showZukanMessage(
        zukanCategories,
        "図鑑を読み込んでいます…"
    );

    try {
        // 既存のapiFetchでユーザーIDも送信される
        const res = await apiFetch("/zukan");

        if (!res.ok) {
            throw new Error(
                `図鑑の取得に失敗しました (${res.status})`
            );
        }

        const data = await res.json();

        // 古い通信結果で表示を上書きしない
        if (requestId !== zukanRequestId) return;

        if (
            !Array.isArray(data) ||
            !data.every((category) =>
                Array.isArray(category.words) &&
                Number.isFinite(category.total) &&
                Number.isFinite(category.collected)
            )
        ) {
            throw new Error("図鑑のデータ形式が正しくありません");
        }

        zukanData = data;
        renderZukanCategories();

    } catch (error) {
        if (requestId !== zukanRequestId) return;

        console.error(error);

        document.getElementById("encyclopedia-total").textContent =
            "取得失敗";

        showZukanMessage(
            zukanCategories,
            "図鑑を読み込めませんでした。タイトルに戻って、もう一度開いてください。"
        );
    }
}


/* --------------------------
   図鑑トップ：カテゴリ一覧
-------------------------- */

function renderZukanCategories() {
    zukanCategories.replaceChildren();

    // 全カテゴリの合計
    const total = zukanData.reduce(
        (sum, category) => sum + category.total,
        0
    );

    const collected = zukanData.reduce(
        (sum, category) => sum + category.collected,
        0
    );

    document.getElementById("encyclopedia-total").textContent =
        `${collected} / ${total}語`;

    document.querySelector(
        "#screen-encyclopedia .encyclopedia-description"
    ).textContent = "カテゴリを押すと、その単語帳が開きます";

    if (zukanData.length === 0) {
        showZukanMessage(
            zukanCategories,
            "まだカテゴリがありません。"
        );
        return;
    }

    zukanData.forEach((category) => {
        const remaining = category.total - category.collected;

        const isEmpty = category.collected === 0;

        // 残り1〜2語ならオレンジ枠で強調
        const isNearComplete =
            !isEmpty &&
            remaining > 0 &&
            remaining <= 2;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "encyclopedia-card";

        if (isEmpty) {
            button.classList.add("is-empty");
        } else if (isNearComplete) {
            button.classList.add("is-near-complete");
        }

        // カテゴリ名
        const name = document.createElement("p");
        name.className = "encyclopedia-name";
        name.textContent = category.category || "その他";

        // 収集数・残りの数
        const count = document.createElement("p");
        count.className = "encyclopedia-count";

        if (isEmpty) {
            count.textContent = "まだ0語・撮ってみよう";
        } else {
            const number = document.createElement("span");
            number.textContent =
                `${category.collected} / ${category.total}`;

            count.append(number);

            if (isNearComplete) {
                const message = document.createElement("span");
                message.className = "encyclopedia-remaining";
                message.textContent = `あと${remaining}語！`;

                count.append(message);
            }
        }

        // 進捗バー
        const progress = document.createElement("progress");
        progress.className = "encyclopedia-progress";
        progress.max = Math.max(category.total, 1);
        progress.value = category.collected;

        progress.setAttribute(
            "aria-label",
            `${name.textContent}：${category.total}語中${category.collected}語発見済み`
        );

        // アイコンなし：名前→件数→進捗バー
        button.append(name, count, progress);

        // 0語のカテゴリも開ける
        button.addEventListener("click", () => {
            openZukanCategory(category);
        });

        zukanCategories.append(button);
    });
}


/* --------------------------
   カテゴリ詳細を開く
-------------------------- */

function openZukanCategory(category) {
    selectedZukanCategory = category;
    zukanFilter = "all";

    document.getElementById("category-title").textContent =
        category.category || "その他";

    document.getElementById("category-progress").textContent =
        `${category.collected} / ${category.total}語`;

    updateZukanTabs();
    renderZukanWords();

    showScreen("screen-category-detail");
}


/* --------------------------
   タブの表示・件数を更新
-------------------------- */

function updateZukanTabs() {
    if (!selectedZukanCategory) return;

    const words = selectedZukanCategory.words;

    const foundCount = words.filter(
        (word) => word.found
    ).length;

    const labels = {
        all: `すべて (${words.length})`,
        collected: `発見済み (${foundCount})`,
        missing: `未発見 (${words.length - foundCount})`
    };

    zukanTabs.forEach((tab) => {
        const filter = tab.dataset.filter;
        const active = filter === zukanFilter;

        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
        tab.textContent = labels[filter];
    });
}


/* --------------------------
   写真がない場合の表示
-------------------------- */

function createZukanPhotoPlaceholder(label) {
    const placeholder = document.createElement("div");
    placeholder.className = "zukan-word-lock";
    placeholder.textContent = "📷";
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", label);

    return placeholder;
}


/* --------------------------
   カテゴリ詳細：単語一覧
-------------------------- */

function renderZukanWords() {
    if (!selectedZukanCategory) return;

    zukanWordList.replaceChildren();

    // 選択中のタブに合わせて絞り込む
    const words = selectedZukanCategory.words.filter((word) => {
        if (zukanFilter === "collected") {
            return word.found;
        }

        if (zukanFilter === "missing") {
            return !word.found;
        }

        return true;
    });

    // 該当する単語がない場合
    if (words.length === 0) {
        const messages = {
            all: "このカテゴリにはまだ単語がありません。",
            collected:
                "まだ発見した単語がありません。写真を撮って集めよう！",
            missing:
                "このカテゴリの単語はすべて発見済みです！"
        };

        showZukanMessage(
            zukanWordList,
            messages[zukanFilter]
        );

        return;
    }

    const fragment = document.createDocumentFragment();

    words.forEach((word) => {
        const card = document.createElement("div");
        card.className = "zukan-word-card";

        if (word.found) {
            // 発見済み：写真と英語を表示
            if (word.image_url) {
                const image = document.createElement("img");
                image.className = "zukan-word-photo";
                image.src = SERVER + word.image_url;
                image.alt = word.japanese;
                image.loading = "lazy";

                // 写真を読み込めなかった場合
                image.addEventListener("error", () => {
                    image.replaceWith(
                        createZukanPhotoPlaceholder(
                            "写真を表示できません"
                        )
                    );
                }, { once: true });

                card.append(image);

            } else {
                card.append(
                    createZukanPhotoPlaceholder("写真なし")
                );
            }

            const english = document.createElement("p");
            english.className = "zukan-word-en";
            english.textContent = word.word;

            card.append(english);

        } else {
            // 未発見：英語と写真は表示しない
            card.classList.add("is-missing");

            const lock = document.createElement("div");
            lock.className = "zukan-word-lock";
            // ホーム画面のキャラクターをコピー
            const mascot = document.querySelector("#screen-title .mascot").cloneNode(true);

            mascot.removeAttribute("id");
            mascot.setAttribute("class", "zukan-mascot");

            const status = document.createElement("p");
            status.className = "zukan-word-status";
            status.textContent = "未発見";

            card.append(lock, status);
        }

        // 日本語は発見済み・未発見の両方に表示
        const japanese = document.createElement("p");
        japanese.className = "zukan-word-ja";
        japanese.textContent = word.japanese;

        card.append(japanese);
        fragment.append(card);
    });

    zukanWordList.append(fragment);
}


/* --------------------------
   ボタンの操作
-------------------------- */

// ホーム → 図鑑
document.getElementById("open-encyclopedia")
    .addEventListener("click", openZukan);

// 図鑑 → ホーム
document.getElementById("encyclopedia-home")
    .addEventListener("click", () => {
        showScreen("screen-title");
    });

// カテゴリ詳細 → 図鑑
["category-back", "category-return"].forEach((id) => {
    document.getElementById(id).addEventListener("click", () => {
        showScreen("screen-encyclopedia");
    });
});

// すべて・発見済み・未発見の切替
zukanTabs.forEach((tab) => {
    tab.type = "button";

    tab.addEventListener("click", () => {
        zukanFilter = tab.dataset.filter;

        updateZukanTabs();
        renderZukanWords();
    });
});

/* ==========================
   図鑑機能：ここまで
========================== */