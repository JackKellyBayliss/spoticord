@echo off
setlocal
:PROMPT
SET /P REALLYSURE=Executing this git-update.bat file will override any changes you have made, are you sure you want to continue? (Y/[N]): 
IF /I "%REALLYSURE%" NEQ "Y" GOTO END
git fetch --all
git reset --hard origin/master
git pull origin master
:END
endlocal
pause