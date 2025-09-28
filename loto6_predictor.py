import pandas as pd
import numpy as np
import openpyxl

def create_dummy_data(num_records=1000, file_path='dummy_loto6.xlsx'):
    """
    LOTO6のダミーデータを生成し、xlsxファイルとして保存する。
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

    # xlsxファイルとして保存
    df.to_excel(file_path, index=False, engine='openpyxl')
    print(f"ダミーデータを {file_path} に保存しました。")

from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
import matplotlib.pyplot as plt

def load_and_preprocess_data(file_path='dummy_loto6.xlsx', sequence_length=5):
    """
    データを読み込み、前処理を行う。
    """
    # データの読み込み
    df = pd.read_excel(file_path)

    # 当選番号の列を選択
    number_cols = ['第1数字', '第2数字', '第3数字', '第4数字', '第5数字', '第6数字']
    data = df[number_cols].values

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

if __name__ == '__main__':
    # ステップ1: ダミーデータの作成
    create_dummy_data(num_records=200) # 学習時間を考慮し、レコード数を減らす

    # ステップ2: データの前処理
    X, y, scaler = load_and_preprocess_data()
    print("データの前処理が完了しました。")
    print("X shape:", X.shape)
    print("y shape:", y.shape)

    # ステップ3: LSTMモデルの構築
    model = build_model((X.shape[1], X.shape[2]))
    print("\nモデルのサマリー:")
    model.summary()

    # ステップ4: モデルの学習
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

    # ステップ5: 結果の可視化と予測
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

        # 予測結果をPythonのint型に変換し、重複を除いてソート
        final_numbers = sorted([int(x) for x in set(np.round(predicted_numbers[0]).astype(int))])

        return final_numbers

    # 学習曲線をプロット
    plot_history(history)

    # 次回の当選番号を予測
    predicted_numbers = predict_next_numbers(model, X, scaler)
    print("\n次回の予測当選番号:")
    print(predicted_numbers)