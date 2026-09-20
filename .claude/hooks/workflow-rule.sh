#!/usr/bin/env bash
# Fires on every user prompt (UserPromptSubmit) and injects the project's
# workflow rule, so the Plan -> Code -> Test -> Review discipline is applied
# by rule rather than by whether it happened to be remembered.
#
# Kept deliberately short: this text is prepended to every single request,
# so anything verbose here is paid for on every turn.
cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"QUY TAC DU AN (ap dung moi request):\n\n1. Phan loai yeu cau truoc khi lam:\n   - TAM THUONG (doi text/mau/typo, tra loi cau hoi, doc code): lam truc tiep. Noi ro mot cau la bo qua pipeline vi viec nho.\n   - DANG KE (them tinh nang, sua bug chua ro nguyen nhan, refactor, doi cau truc, dung toi toan so sach mua/ban hoac dong bo du lieu): chay pipeline tuan tu planner -> coder -> tester -> reviewer.\n\n2. Khi chay pipeline: moi agent khoi dong tu con so 0, KHONG thay hoi thoai nay va KHONG thay ket qua agent truoc. Prompt gui cho chung phai tu chua du thong tin (file, dong, so lieu, tieu chi kiem chung). Chay foreground vi cac buoc phu thuoc nhau.\n\n3. Khong tin bao cao suong: agent noi 'da sua' thi tu kiem bang git diff; agent noi 'test pass' thi nhin so lieu that.\n\n4. Truoc khi ket thuc luot co sua file: ghi commit message mo ta dung thay doi vao .claude/hooks/.next-commit-message.txt; neu la thay doi nguoi dung thay duoc tren GoldTrack thi bump data/changelog.json.\n\n5. Khong tuyen bo 'da hoat dong' neu chua thuc su chay thu. Chua kiem chung duoc thi noi ro la chua kiem chung duoc."}}
EOF
