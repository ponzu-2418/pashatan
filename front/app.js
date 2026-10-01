const SERVER = "https://char-occurrence-wells-termination.trycloudflare.com"

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
    const res = await fetch(SERVER + "/answer",{
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({quiz_id: quizId, choice: choice})
    });
    const result = await res.json();
    showResult(result);
}

function showError(message){
    showScreen("screen-title");
    errorText = message;
}

console.log("パシャ単を起動しました");
const recordButton = document.getElementById("record");
const errorText = document.getElementById("error");

recordButton.addEventListener("click" , () =>{
    console.log("記録ボタンが押された");
    showScreen("screen-record");
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
