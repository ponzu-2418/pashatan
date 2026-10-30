import csv
import os
from datetime import datetime, date, timedelta

RECORDS_FILE = "records.csv"


# 記録を読む：その人（user_id）の記録だけを返す
def load_records(user_id):                                   # ★ user_id を受け取る
    if not os.path.exists(RECORDS_FILE):
        return []
    with open(RECORDS_FILE, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    return [r for r in rows if r["user_id"] == user_id]      # ★ その人の行だけ


# 記録を書く：誰の記録か（user_id）も一緒に書く
def save_record(word, correct, image_url, user_id):         # ★ user_id を受け取る
    is_new = not os.path.exists(RECORDS_FILE) or os.path.getsize(RECORDS_FILE) == 0
    with open(RECORDS_FILE, "a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        if is_new:
            writer.writerow(["datetime", "word", "correct", "image_url", "user_id"])  # ★ 見出しに user_id
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        writer.writerow([now, word, int(correct), image_url, user_id])            # ★ 最後に user_id


# 連続日数を数える（変更なし）
def calc_streak(records):
    days = {r["datetime"][:10] for r in records}
    streak = 0
    day = date.today()
    if day.isoformat() not in days:
        day -= timedelta(days=1)
    while day.isoformat() in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


# 復習が必要な単語（最後の回答が不正解のもの）（変更なし）
def review_list(records):
    last = {}
    for r in records:
        last[r["word"]] = r
    return [r for r in last.values() if r["correct"] == "0"]


# 正答率（単語ごとの最後の結果で計算する）（変更なし）
def word_accuracy(records):
    last = {}
    for r in records:
        last[r["word"]] = r
    if len(last) == 0:
        return 0
    correct = 0
    for r in last.values():
        if r["correct"] == "1":
            correct += 1
    return round(correct / len(last), 2)