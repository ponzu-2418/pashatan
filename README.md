# パシャ単

写真に写ったものを英単語クイズにして、毎日の学習を記録するアプリ。

## 担当
- server/：サーバー（FastAPI）
- front/：画面（Python）

## サーバーの起動方法
    cd server
    pip install -r requirements.txt
    uvicorn main:app --reload --host 0.0.0.0

起動したら http://localhost:8000/docs で API を試せる。

## ルール
- 作業を始める前にプル、終わったらプッシュ
- 自分のフォルダ以外は触らない
- 動かない状態ではプッシュしない

## ターミナルが開くたびにする
cd C:\oit\home\python\pashatan\server
$env:PYTHONPATH = ""
