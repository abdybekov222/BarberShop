@echo off
rem BARS Barber Club: double-click to start API + website.
rem Fill an empty database with demo data: start.cmd -Seed
chcp 65001 >nul
title BARS Barber Club
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
