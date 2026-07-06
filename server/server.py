import os
from flask import Flask, request, jsonify, send_from_directory
import util

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), '..', 'client'), static_url_path='')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'app.html')

@app.route('/get_location_names', methods=['GET'])
def get_location_names():
    response = jsonify({
        'locations': util.get_location_names()
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/api/get_location_names', methods=['GET'])
def api_get_location_names():
    return get_location_names()

@app.route('/predict_home_price', methods=['GET', 'POST'])
def predict_home_price():
    total_sqft = float(request.form['total_sqft'])
    location = request.form['location']
    bhk = int(request.form['bhk'])
    bath = int(request.form['bath'])

    response = jsonify({
        'estimated_price': util.get_estimated_price(location,total_sqft,bhk,bath)
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/api/predict_home_price', methods=['GET', 'POST'])
def api_predict_home_price():
    return predict_home_price()

if __name__ == "__main__":
    print("Starting Python Flask Server For Home Price Prediction...")
    util.load_saved_artifacts()
    app.run()