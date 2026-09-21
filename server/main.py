# main.py
from fastapi import FastAPI

app = FastAPI()          # アプリ本体を作る

@app.get("/")            # 「/ に GET で来たら下の関数を動かす」という印
def hello():
    return {"message": "Hello パシャ単"}