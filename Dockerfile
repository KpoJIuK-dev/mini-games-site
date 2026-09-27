FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./
COPY itemsData_OB55.json ./
COPY core ./core
COPY arcade ./arcade

ENV PORT=8081
ENV PYTHONUNBUFFERED=1
EXPOSE 8081

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 2 --timeout 90 --access-logfile - app:app"]
