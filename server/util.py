import json
import os
import warnings
import joblib
import numpy as np
import pandas as pd
from sklearn.exceptions import InconsistentVersionWarning
from sklearn.linear_model import LinearRegression

warnings.filterwarnings('ignore', category=InconsistentVersionWarning)
warnings.filterwarnings('ignore', message='X does not have valid feature names')

__locations = None
__data_columns = None
__model = None

ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'artifacts')
ROOT_DIR = os.path.abspath(os.path.join(ARTIFACT_DIR, '..', '..'))
MODEL_DIR = os.path.join(ROOT_DIR, 'model')


def _parse_total_sqft(value):
    try:
        if isinstance(value, str):
            cleaned = value.replace(',', '').strip()
            if '-' in cleaned:
                low, high = cleaned.split('-', 1)
                return (float(low) + float(high)) / 2
            return float(cleaned)
        return float(value)
    except Exception:
        return None


def _train_and_save_model():
    global __model
    csv_path = os.path.join(MODEL_DIR, 'bengaluru_house_prices.csv')
    columns_path = os.path.join(ARTIFACT_DIR, 'columns.json')

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f'Model training data not found: {csv_path}')

    with open(columns_path, 'r') as f:
        data_columns = json.load(f)['data_columns']

    df = pd.read_csv(csv_path)
    required_columns = ['location', 'total_sqft', 'bath', 'price']
    df = df.dropna(subset=required_columns)
    df['total_sqft'] = df['total_sqft'].apply(_parse_total_sqft)
    df['bath'] = pd.to_numeric(df['bath'], errors='coerce')
    df['price'] = pd.to_numeric(df['price'], errors='coerce')
    df = df[(df['total_sqft'] > 0) & (df['bath'] > 0) & (df['price'] > 0)]
    df['location'] = df['location'].str.lower().str.strip()

    locations = data_columns[3:]
    X = []
    y = []

    for _, row in df.iterrows():
        try:
            loc_index = locations.index(row['location'])
        except ValueError:
            continue

        x = np.zeros(len(data_columns))
        bhk = 2 if 'bhk' not in df.columns else float(row['bhk'])
        x[0] = float(row['total_sqft'])
        x[1] = float(row['bath'])
        x[2] = bhk
        x[3 + loc_index] = 1
        X.append(x)
        y.append(float(row['price']))

    if not X:
        raise ValueError('No training rows were prepared for the model.')

    __model = LinearRegression()
    __model.fit(np.array(X), np.array(y))

    model_path = os.path.join(ARTIFACT_DIR, 'banglore_home_prices_model.joblib')
    root_model_path = os.path.join(MODEL_DIR, 'banglore_home_prices_model.joblib')
    joblib.dump(__model, model_path)
    joblib.dump(__model, root_model_path)
    return __model

def get_estimated_price(location,sqft,bhk,bath):
    if __data_columns is None or __model is None:
        load_saved_artifacts()

    try:
        loc_index = __data_columns.index(location.lower())
    except Exception:
        loc_index = -1

    x = np.zeros(len(__data_columns))
    x[0] = float(sqft)
    x[1] = float(bath)
    x[2] = float(bhk)
    if loc_index >= 0:
        x[loc_index] = 1

    return round(__model.predict([x])[0], 2)


def load_saved_artifacts():
    print("loading saved artifacts...start")
    global __data_columns
    global __locations
    global __model

    columns_path = os.path.join(ARTIFACT_DIR, 'columns.json')
    with open(columns_path, 'r') as f:
        __data_columns = json.load(f)['data_columns']
        __locations = __data_columns[3:]  # first 3 columns are sqft, bath, bhk

    if __model is None:
        print('rebuilding model artifact for the current environment...')
        _train_and_save_model()

    print("loading saved artifacts...done")

def get_location_names():
    return __locations

def get_data_columns():
    return __data_columns

if __name__ == '__main__':
    load_saved_artifacts()
    print(get_location_names())
    print(get_estimated_price('1st Phase JP Nagar',1000, 3, 3))
    print(get_estimated_price('1st Phase JP Nagar', 1000, 2, 2))
    print(get_estimated_price('Kalhalli', 1000, 2, 2)) # other location
    print(get_estimated_price('Ejipura', 1000, 2, 2))  # other location