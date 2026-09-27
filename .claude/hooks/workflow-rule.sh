#!/usr/bin/env bash
# Fires on every user prompt (UserPromptSubmit) and injects the project's
# workflow rule, so the Plan -> Code -> Test -> Review discipline is applied
# by rule rather than by whether it happened to be remembered.
#
# Kept deliberately short: this text is prepended to every single request,
# so anything verbose here is paid for on every turn. Details live in
# CLAUDE.md, .claude/commands/workflow.md and the skills.
cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"QUY TAC DU AN (ap dung moi request):\n\n1. Phan loai yeu cau truoc khi lam:\n   - TAM THUONG (doi text/mau/thu tu, typo, tra loi cau hoi, doc code): lam truc tiep. Noi ro mot cau la bo qua pipeline vi viec nho.\n   - DANG KE (them tinh nang, sua bug chua ro nguyen nhan, refactor, doi cau truc, dung toi toan so sach mua/ban hoac dong bo du lieu): chay pipeline planner -> coder -> tester -> reviewer (xem .claude/commands/workflow.md).\n\n2. Khi chay pipeline: moi agent khoi dong tu con so 0. Prompt phai tu chua du thong tin (file, dong, so lieu, kich ban + so ky vong tinh tay). Chay foreground.\n\n3. Khong tin bao cao suong: 'da sua' -> xem git diff; 'test pass' -> xem so lieu that.\n\n4. Truoc khi ket thuc luot co sua file: git status --short. Ghi commit message vao .claude/hooks/.next-commit-message.txt; neu co file/message cua phien khac thi tu git add + commit rieng file cua minh, KHONG ghi de. Thay doi nguoi dung thay duoc -> bump products/<ten>/data/changelog.json.\n\n5. Khong tuyen bo 'da hoat dong' neu chua thuc su chay thu (cong cu: .claude/tools, skill browser-testing). Loi chi tren iPhone that thi Chromium khong kiem duoc -> noi ro 'chua kiem chung tren may that' va xin so do tu may."}}
EOF
