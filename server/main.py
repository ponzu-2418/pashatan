# server/main.py（仮サーバー：決まった値を返すだけ）
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import random
from datetime import datetime
from PIL import Image, ImageOps
from clip_model import load_words, ClipJudge
from records import load_records, save_record, calc_streak, review_list, word_accuracy
import csv

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
# 単語ごとのカテゴリと関連語を読み込む
def load_extra(path="word_extra.csv"):
    extra = {}
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            extra[row["word"]] = row
    return extra

EXTRA = load_extra()

judge = ClipJudge(WORDS)
QUIZZES = {}   # quiz_id → 正解と写真の場所を覚えておく辞書
next_id = 1
MIN_SCORE = 0.3   # 1位の確率がこれより低ければ「認識できない」とする

# 写真の真ん中だけを切り出す（背景に引っ張られにくくする）
def center_crop(img, ratio=0.8):
    w, h = img.size
    cw, ch = int(w * ratio), int(h * ratio)
    left, top = (w - cw) // 2, (h - ch) // 2
    return img.crop((left, top, left + cw, top + ch))

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

    # 写真を開いて、スマホの向きの情報どおりに回転させる
    img = Image.open(image.file)
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    img.thumbnail((800, 800))
    top = judge.top4(center_crop(img))
    print("判定結果:", [(w, round(s, 2)) for w, s in top], flush=True)

    # 1位の確率が低すぎたら、問題を作らずにエラーを返す
    if top[0][1] < MIN_SCORE:
        raise HTTPException(
            status_code=400,
            detail="うまく認識できませんでした。物を大きく写して、もう一度撮ってください。",
        )

    # ここから先は今までと同じ
    quiz_id = next_id
    next_id += 1
    filename = datetime.now().strftime("%Y%m%d_%H%M%S") + f"_{quiz_id}.jpg"
    img.save(f"photos/{filename}", quality=80)

    choices = [word for word, score in top]
    answer = choices[0]
    QUIZZES[quiz_id] = {"answer": answer, "image_url": f"/photos/{filename}"}

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
    extra = EXTRA.get(answer, {})
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
        "category": extra.get("category", ""),
        "related": extra.get("related", ""),
        "streak": streak,
        "streak_up": first_today,
    }

# ③ 記録を見る
@app.get("/stats")
def get_stats():
    records = load_records()
    today = datetime.now().strftime("%Y-%m-%d")

    # 正答率（単語ごとの最後の結果で計算する）
    known = [r for r in records if r["word"] in WORDS]
    accuracy = word_accuracy(known)

    # 今日の回答だけを集める
    today_list = []
    for r in records:
        if r["word"] not in WORDS:
            continue   # 単語リストから消した単語は飛ばす
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
        if w not in WORDS:
            continue   # 単語リストから消した単語は飛ばす
        if w not in book:
            book[w] = {
                "word": w,
                "japanese": WORDS[w]["japanese"],
                "explanation": WORDS[w]["explanation"],
                "category": EXTRA.get(w, {}).get("category", ""),
                "related": EXTRA.get(w, {}).get("related", ""),
                "seen": 0,
                "correct": 0,
            }
        book[w]["seen"] += 1
        book[w]["correct"] += int(r["correct"])
        book[w]["image_url"] = r["image_url"]        # 後の記録で上書き → 最新の写真
        book[w]["last_seen"] = r["datetime"]
        book[w]["last_correct"] = r["correct"] == "1"   # 後の記録で上書き → 最後の結果

    # 最後に出た日が新しい順に並べる
    return sorted(book.values(), key=lambda b: b["last_seen"], reverse=True)

# ⑤ 復習：間違えた単語を、前に撮った写真でもう一度出題する
@app.get("/review")
def get_review():
    global next_id

    # 復習が必要な単語を集める（単語リストから消した単語は除く）
    targets = [r for r in review_list(load_records()) if r["word"] in WORDS]
    if not targets:
        return {"quiz_id": None, "remaining": 0}

    r = random.choice(targets)
    answer = r["word"]

    # 保存してある写真をもう一度 CLIP にかけて、似た単語を集める
    try:
        img = Image.open(r["image_url"].lstrip("/")).convert("RGB")
        similar = [w for w, s in judge.top4(center_crop(img))]
    except FileNotFoundError:
        similar = []   # 写真が消えていたら、似た単語なしで進める

    # 正解以外の3つを選ぶ（足りなければランダムで補う）
    others = [w for w in similar if w != answer]
    while len(others) < 3:
        w = random.choice(list(WORDS))
        if w != answer and w not in others:
            others.append(w)

    choices = [answer] + others[:3]
    random.shuffle(choices)

    quiz_id = next_id
    next_id += 1
    QUIZZES[quiz_id] = {"answer": answer, "image_url": r["image_url"]}

    return {
        "quiz_id": quiz_id,
        "choices": choices,
        "image_url": r["image_url"],
        "remaining": len(targets),
    }

# 相方の画面（front フォルダ）を /app で見られるようにする
app.mount("/app", StaticFiles(directory="../front", html=True), name="front")