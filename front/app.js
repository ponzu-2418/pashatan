const SERVER = ""

function showScreen(id){
    const screens = document.querySelectorAll(".screen");
    screens.forEach((screen) => {
        screen.classList.remove("active");
    });
    document.getElementById(id).classList.add("active");
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

async function createQuiz(file){
    try{
        const form = new FormData();
        form.append("image",file);
        const res = await fetch(SERVER + "/quiz", {
            method: "POST",
            body: form
    });
    if (!res.ok){
        throw new Error("サーバーに断られました");
    }
    const quiz = await res.json();
    quizId = quiz.quiz_id;
    showQuestion(quiz);
    }catch(error){
        console.error(error);
        showError("うまくいきませんでした。もう一度撮ってね。");
    }
}

function showResult(result){
    if(result.correct){
        document.getElementById("correct").textContent = "正解！";
    }else{
        document.getElementById("correct").textContent = "不正解！";
    }
    document.getElementById("word").textContent = result.answer;
    document.getElementById("japanese").textContent = result.japanese;
    document.getElementById("explan").textContent = result.explanation;
    showScreen("screen-result");
}

async function sendAnswer(choice){
    try {
        const res = await fetch(SERVER + "/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quiz_id: quizId, choice: choice })
        });
        if (!res.ok) {
            throw new Error("サーバーに断られました");
        }
        const result = await res.json();
        showResult(result);
    } catch (error) {
        console.error(error);
        showError("答え合わせに失敗しました。もう一度撮ってね。");
    }
}

function showError(message){
    showScreen("screen-title");
    errorText.textContent = message;
}

async function loadStats(){
    try{
        const res = await fetch(SERVER + "/stats");
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
    try{
        const res = await fetch(SERVER + "/words");
        if (!res.ok){
            throw new Error("サーバーに断られました");
        }
        const words = await res.json();
        document.getElementById("word-count").textContent = words.length + "つの単語を集めたよ";

        const list = document.getElementById("record-list");
        list.innerHTML = "";

        words.forEach((w) => {

            const mark = document.createElement("span");
            if(w.last_correct){
            mark.className = "mark ok";
            mark.textContent = "〇";
            }else{
                mark.clssName = "mark ng";
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
            li.append(img,text);
            li.addEventListener("click", () => {
                showWordDetail(w);
            });
            list.append(li);
        });
    }catch(error){
        console.error(error);
        showError("単語帳を読み込めませんでした。");
    }
}

function showWordDetail(w){
    document.getElementById("detail-photo").src = SERVER + w.image_url;
    document.getElementById("detail-en").textContent = w.word;
    document.getElementById("detail-ja").textContent = w.japanese;
    document.getElementById("detail-explan").textContent = w.explanation || "解説はあだありません";
    showScreen("screen-word");
}
console.log("パシャ単を起動しました");
const recordButton = document.getElementById("record");
const errorText = document.getElementById("error");

recordButton.addEventListener("click" , () =>{
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
    showScreen("screen-word");
});