from flask import Blueprint, jsonify

api_health_bp = Blueprint("api_health_bp", __name__)


@api_health_bp.route("/api/health", methods=["GET"])
def api_health():
    return jsonify({"status": "ok", "service": "legacy-flask"}), 200
