import pandas as pd
import numpy as np
import openpyxl
import tensorflow as tf
import os
from sklearn.preprocessing import MinMaxScaler
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout
from keras.callbacks import EarlyStopping
import matplotlib.pyplot as plt

def create_dummy_data(num_records=1000, file_path='dummy_loto6.xlsx'):
    """
    LOTO6のダミーデータを生成し、xlsxファイルとして保存する。
    テスト用に無効なデータもいくつか含める。
    """
    # 1から43までの数字の範囲
    numbers_range = np.arange(1, 44)

    # ダミーデータ格納用のリスト
    data = []

    # 日付データの生成
    dates = pd.to_datetime(pd.date_range(end='2023-12-31', periods=num_records, freq='W-MON'))

    for i in range(num_records):
        # 1-43から6つのユニークな数字をランダムに選択
        winning_numbers = np.sort(np.random.choice(numbers_range, 6, replace=False))

        # レコードの作成
        record = {
            '開催回': num_records - i,
            '日付': dates[i],
            '第1数字': winning_numbers[0],
            '第2数字': winning_numbers[1],
            '第3数字': winning_numbers[2],
            '第4数字': winning_numbers[3],
            '第5数字': winning_numbers[4],
            '第6数字': winning_numbers[5],
        }
        data.append(record)

    # データフレームの作成
    df = pd.DataFrame(data)

    # --- テスト用に無効なデータを追加 ---
    # 1. 非数値データ
    if len(df) > 10:
        df.loc[5, '第3数字'] = '無効'
    # 2. 空のセル(NaN)
    if len(df) > 20:
        df.loc[15, '第4数字'] = np.nan

    # xlsxファイルとして保存
    df.to_excel(file_path, index=False, engine='openpyxl')
    print(f"ダミーデータを {file_path} に保存しました。（テスト用の無効なデータを含む）")

def load_and_preprocess_data(file_path='dummy_loto6.xlsx', sequence_length=5):
    """
    データを読み込み、前処理を行う。
    列名に依存せず、列位置でデータを抽出し、データクリーニングも行う。
    """
    try:
        # データの読み込み
        df = pd.read_excel(file_path, header=0)
    except FileNotFoundError:
        print(f"エラー: ファイルが見つかりません: {file_path}")
        return None, None, None

    # 当選番号の列を位置で選択 (C列からH列 -> インデックス 2から7)
    if df.shape[1] < 8:
        print("エラー: Excelファイルには当選番号を含む十分な列がありません。C列からH列に数値データが必要です。")
        return None, None, None

    number_data = df.iloc[:, 2:8].copy()

    # --- データクリーニング ---
    original_rows = len(number_data)

    # 1. 数値に変換できない値をNaNにする
    for col in number_data.columns:
        number_data.loc[:, col] = pd.to_numeric(number_data[col], errors='coerce')

    # 2. NaNを含む行を削除
    number_data.dropna(inplace=True)

    cleaned_rows = len(number_data)
    if original_rows > cleaned_rows:
        print(f"情報: {original_rows - cleaned_rows}行に無効なデータ（非数値や空セル）が含まれていたため、除外しました。")

    # 3. データを整数に変換
    data = number_data.astype(np.int64).values

    if len(data) < sequence_length + 1:
        print(f"エラー: 有効なデータが{len(data)}行しかなく、学習に必要なシーケンス長（{sequence_length+1}）に満たないため、処理を中断します。")
        return None, None, None

    # データの正規化
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(data)

    # シーケンスデータの作成
    X, y = [], []
    for i in range(len(scaled_data) - sequence_length):
        X.append(scaled_data[i:i+sequence_length])
        y.append(scaled_data[i+sequence_length])

    return np.array(X), np.array(y), scaler

def build_model(input_shape):
    """
    LSTMモデルを構築する。
    """
    model = Sequential([
        LSTM(50, return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(50),
        Dropout(0.2),
        Dense(25),
        Dense(6) # 出力層: 6つの数字を予測
    ])

    model.compile(optimizer='adam', loss='mean_squared_error')
    return model

def is_drive_mounted():
    return os.path.exists('/content/drive/MyDrive')

if __name__ == '__main__':
    if not is_drive_mounted():
        from google.colab import drive
        drive.mount('/content/drive')
    # --- 設定 ---
    # 実際のLOTO6データが入ったExcelファイルのパスを指定してください。
    # このパスが空欄の場合、プログラムは自動でダミーデータを生成して実行します。
    # 例: FILE_PATH = 'C:/Users/YourUser/Documents/loto6_data.xlsx'
    FILE_PATH = '/content/drive/MyDrive/tf_models/loto6.xlsx' # ← ここに実際のファイルのパスを入力

    SEQUENCE_LENGTH = 1500  # 過去何回分のデータを使って次を予測するか

    # --- 処理開始 ---

    # ファイルパスが指定されていない場合は、ダミーデータを生成
    if not FILE_PATH:
        print("情報: ファイルパスが指定されていません。ダミーデータを生成して処理を続行します。")
        FILE_PATH = 'dummy_loto6.xlsx'
        create_dummy_data(num_records=200, file_path=FILE_PATH)

    # ステップ1: データの読み込みと前処理
    print(f"\n--- ステップ1: データを '{FILE_PATH}' から読み込み ---")
    X, y, scaler = load_and_preprocess_data(file_path=FILE_PATH, sequence_length=SEQUENCE_LENGTH)

    # データ読み込みでエラーが発生した場合は終了
    if X is None:
        print("\nデータ処理に失敗したため、プログラムを終了します。")
    else:
        print("データの前処理が完了しました。")
        print("X shape:", X.shape)
        print("y shape:", y.shape)

        # ステップ2: LSTMモデルの構築
        print("\n--- ステップ2: LSTMモデルの構築 ---")
        model = build_model((X.shape[1], X.shape[2]))
        print("モデルのサマリー:")
        model.summary()

        # ステップ3: モデルの学習
        print("\n--- ステップ3: モデルの学習 ---")
        early_stopping = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
        history = model.fit(
            X, y,
            epochs=100,
            batch_size=32,
            validation_split=0.2,
            callbacks=[early_stopping],
            verbose=1
        )
        print("\nモデルの学習が完了しました。")

        # ステップ4: 結果の可視化と予測
        print("\n--- ステップ4: 結果の可視化と予測 ---")
        def plot_history(history):
            plt.figure(figsize=(10, 6))
            plt.plot(history.history['loss'], label='Training Loss')
            plt.plot(history.history['val_loss'], label='Validation Loss')
            plt.title('Model Loss')
            plt.ylabel('Loss')
            plt.xlabel('Epoch')
            plt.legend()
            plt.savefig('learning_curve.png')
            print("\n学習曲線を learning_curve.png として保存しました。")

        def predict_next_numbers(model, data, scaler):
            last_sequence = data[-1:]
            prediction = model.predict(last_sequence)
            predicted_numbers = scaler.inverse_transform(prediction)
            final_numbers = sorted([int(x) for x in set(np.round(predicted_numbers[0]).astype(int))])
            return final_numbers

        plot_history(history)
        predicted_numbers = predict_next_numbers(model, X, scaler)
        print("\n次回の予測当選番号:")
        print(predicted_numbers)

