# server/main.py（仮サーバー：決まった値を返すだけ）
import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import random
from datetime import datetime
from PIL import Image
from clip_model import load_words, ClipJudge

app = FastAPI()

# 相方の画面（別の場所にある HTML）から呼べるようにする設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# photos フォルダの写真を /photos/ファイル名 で見られるようにする
os.makedirs("photos", exist_ok=True)
app.mount("/photos", StaticFiles(directory="photos"), name="photos")

# サーバー起動時に1回だけ準備する
WORDS = load_words()
judge = ClipJudge(WORDS)
QUIZZES = {}   # quiz_id → 正解と写真の場所を覚えておく辞書
next_id = 1

# /answer に送られてくるデータの形
class Answer(BaseModel):
    quiz_id: int
    choice: str


@app.get("/")
def hello():
    return {"message": "Hello パシャ単"}


# ① 写真からクイズを作る
@app.post("/quiz")
def create_quiz(image: UploadFile = File(...)):
    global next_id
    quiz_id = next_id
    next_id += 1

    # 写真を開いて photos フォルダに保存する（名前は日時にして重ならないようにする）
    img = Image.open(image.file).convert("RGB")
    filename = datetime.now().strftime("%Y%m%d_%H%M%S") + f"_{quiz_id}.jpg"
    img.save(f"photos/{filename}")

    # CLIP で上位4つを出し、1位を正解にする
    top = judge.top4(img)
    choices = [word for word, score in top]
    answer = choices[0]

    # 正解を覚えておく
    QUIZZES[quiz_id] = {"answer": answer, "image_url": f"/photos/{filename}"}

    # 選択肢を混ぜて返す（混ぜないと、いつも1番目が正解になってしまう）
    random.shuffle(choices)
    return {"quiz_id": quiz_id, "choices": choices}


# ② 答え合わせ
@app.post("/answer")
def check_answer(data: Answer):
    # 仮：正解はいつも cup
    return {
        "correct": data.choice == "cup",
        "answer": "cup",
        "japanese": "カップ",
        "explanation": "飲み物を入れる取っ手付きの器。TOEICでは給湯室やカフェの場面で出る。",
        "streak": 3,
        "streak_up": True,
    }


# ③ 記録を見る
@app.get("/stats")
def get_stats():
    return {
        "streak": 3,
        "accuracy": 0.76,
        "today": [
            {"word": "cup", "japanese": "カップ", "correct": True, "time": "14:05", "image_url": "/photos/sample.jpg"},
            {"word": "stapler", "japanese": "ホッチキス", "correct": False, "time": "14:07", "image_url": "/photos/sample.jpg"},
        ],
    }


# ④ 単語帳
@app.get("/words")
def get_words():
    return [
        {"word": "cup", "japanese": "カップ", "image_url": "/photos/sample.jpg", "seen": 3, "correct": 2},
        {"word": "stapler", "japanese": "ホッチキス", "image_url": "/photos/sample.jpg", "seen": 1, "correct": 0},
    ]