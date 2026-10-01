# records.py
import csv
import os
from datetime import datetime, date, timedelta

RECORDS_FILE = "records.csv"


# ① これまでの記録を全部読む（ファイルがまだなければ空のリスト）
def load_records():
    if not os.path.exists(RECORDS_FILE):
        return []
    with open(RECORDS_FILE, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


# ② 回答を1行書き足す
def save_record(word, correct, image_url):
    is_new = not os.path.exists(RECORDS_FILE)
    with open(RECORDS_FILE, "a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        if is_new:
            writer.writerow(["datetime", "word", "correct", "image_url"])
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        writer.writerow([now, word, int(correct), image_url])


def calc_streak(records):
    days = {r["datetime"][:10] for r in records}
    streak = 0
    day = date.today()
    if day.isoformat() not in days:
        day -= timedelta(days=1)   # 今日まだ答えていなくても、昨日までの連続は途切れていない
    while day.isoformat() in days:
        streak += 1
        day -= timedelta(days=1)
    return streak