@echo off
color 7F
git fetch --all
git reset --hard origin/master
git pull origin master
pause
