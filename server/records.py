import sqlite3
from datetime import datetime, date, timedelta

DB_FILE = "pashatan.db"   # データベースのファイル名


# データベースにつなぐ
def get_conn():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row   # 列の名前で取り出せるようにする（r["word"] のように）
    return conn


# 表がなければ作る（サーバーの起動時に1回だけ動く）
def init_db():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS records (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id   TEXT    NOT NULL,
            datetime  TEXT    NOT NULL,
            word      TEXT    NOT NULL,
            correct   INTEGER NOT NULL,
            image_url TEXT    NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()


# 記録を読む：その人（user_id）の記録だけを返す
def load_records(user_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT datetime, word, correct, image_url, user_id FROM records WHERE user_id = ? ORDER BY id",
        (user_id,),
    ).fetchall()
    conn.close()
    # CSV のときと同じ形（文字の辞書のリスト）にして返す
    return [
        {
            "datetime": r["datetime"],
            "word": r["word"],
            "correct": str(r["correct"]),   # CSV のときは "1" / "0" の文字だったので合わせる
            "image_url": r["image_url"],
            "user_id": r["user_id"],
        }
        for r in rows
    ]


# 記録を書く：表に1行足す
def save_record(word, correct, image_url, user_id):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_conn()
    conn.execute(
        "INSERT INTO records (user_id, datetime, word, correct, image_url) VALUES (?, ?, ?, ?, ?)",
        (user_id, now, word, int(correct), image_url),
    )
    conn.commit()   # 書いた内容を確定する
    conn.close()

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