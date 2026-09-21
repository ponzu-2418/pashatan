# server/main.py（仮サーバー：決まった値を返すだけ）
import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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
    # 仮：写真は受け取るだけで、まだ使わない
    return {
        "quiz_id": 1,
        "choices": ["cup", "bottle", "vase", "bowl"],
    }


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