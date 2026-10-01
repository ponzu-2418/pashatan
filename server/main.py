# server/main.py（仮サーバー：決まった値を返すだけ）
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import random
from datetime import datetime
from PIL import Image
from clip_model import load_words, ClipJudge
from records import load_records, save_record, calc_streak

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
    # 問題を取り出す（pop なので、同じ問題に2回は答えられない）
    quiz = QUIZZES.pop(data.quiz_id, None)
    if quiz is None:
        raise HTTPException(status_code=404, detail=f"quiz_id {data.quiz_id} が見つかりません")

    answer = quiz["answer"]
    info = WORDS[answer]
    correct = data.choice == answer

    # 今日の1問目かどうか（エフェクト用）を、記録する前に調べておく
    today = datetime.now().strftime("%Y-%m-%d")
    first_today = not any(r["datetime"].startswith(today) for r in load_records())

    # 記録して、連続日数を数える
    save_record(answer, correct, quiz["image_url"])
    streak = calc_streak(load_records())

    return {
        "correct": correct,
        "answer": answer,
        "japanese": info["japanese"],
        "explanation": info["explanation"],
        "streak": streak,
        "streak_up": first_today,
    }


# ③ 記録を見る
@app.get("/stats")
def get_stats():
    records = load_records()
    today = datetime.now().strftime("%Y-%m-%d")

    # 正答率（まだ回答がなければ 0）
    if records:
        accuracy = sum(int(r["correct"]) for r in records) / len(records)
    else:
        accuracy = 0

    # 今日の回答だけを集める
    today_list = []
    for r in records:
        if r["datetime"].startswith(today):
            today_list.append({
                "word": r["word"],
                "japanese": WORDS[r["word"]]["japanese"],
                "correct": r["correct"] == "1",
                "time": r["datetime"][11:16],
                "image_url": r["image_url"],
            })

    return {
        "streak": calc_streak(records),
        "accuracy": round(accuracy, 2),
        "today": today_list,
    }


# ④ 単語帳
@app.get("/words")
def get_words():
    book = {}   # 単語 → その単語の集計
    for r in load_records():
        w = r["word"]
        if w not in book:
            book[w] = {"word": w, "japanese": WORDS[w]["japanese"], "seen": 0, "correct": 0}
        book[w]["seen"] += 1
        book[w]["correct"] += int(r["correct"])
        book[w]["image_url"] = r["image_url"]   # 後の記録で上書きされるので、最新の写真が残る
        book[w]["last_seen"] = r["datetime"]

    # 最後に出た日が新しい順に並べる
    return sorted(book.values(), key=lambda b: b["last_seen"], reverse=True)