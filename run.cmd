@echo off
REM Double-click to view Scale of Everything locally.
REM ES modules need a real origin, so a plain file:// open will not work.
cd /d "%~dp0"
start "" http://127.0.0.1:8080/
echo Serving Scale of Everything at http://127.0.0.1:8080/
echo Close this window to stop.
python -m http.server 8080
