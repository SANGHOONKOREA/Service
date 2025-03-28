
    /****************************************
     1) Firebase 초기화
    *****************************************/
    const firebaseConfig = {
      apiKey: "AIzaSyCoOg2HPjk-oEhtVrLv3hH-3VLCwa2MAfE",
      authDomain: "sanghoon-d8f1c.firebaseapp.com",
      databaseURL: "https://sanghoon-d8f1c-default-rtdb.firebaseio.com",
      projectId: "sanghoon-d8f1c",
      storageBucket: "sanghoon-d8f1c.appspot.com",
      messagingSenderId: "495391900753",
      appId: "1:495391900753:web:b0d708eeca64fafe562470",
      measurementId: "G-J2E22BW61H"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const auth = firebase.auth();

    /****************************************
     2) 전역 변수
    *****************************************/
    let currentUser = null;  
    let currentUid = null;   
    let users = {};          
    let schedules = [];
    let companyColors = {};
    let histories = [];
    let historyLimit = 100;
    let currentMonthDate = new Date();
    let currentWeekDate = new Date();
    let editingScheduleId = null;
    let timeTableData = [];

    /****************************************
     3) 페이지 로드 시 초기 작업
    *****************************************/
    window.onload = () => { checkAutoLogin(); };

    /****************************************
     4) Firebase Auth 상태 변화 감지
    *****************************************/
    auth.onAuthStateChanged(user => {
      if (user) {
        currentUid = user.uid;
        db.ref("users/" + user.uid).once("value")
          .then(snap => {
            if (!snap.exists()) {
              alert("DB에 등록되지 않은 사용자입니다. 관리자에게 문의하세요.");
              logout();
              throw new Error("사용자 프로필 없음");
            } else {
              return snap.val();
            }
          })
          .then(userData => {
            if (userData) {
              currentUser = userData;
              document.getElementById("login-container").style.display = "none";
              document.getElementById("main-menu").style.display = "flex";
              document.getElementById("btnAdmin").style.display = (currentUser.role === "관리자") ? "inline-block" : "none";
              // 본사 권한이면 현황 버튼 표시
              document.getElementById("btnStatus").style.display = (currentUser.role === "본사") ? "inline-block" : "none";
              loadAllData().then(() => { showSection("monthly"); });
            }
          })
          .catch(err => { console.error(err); });
      } else {
        document.getElementById("login-container").style.display = "block";
        document.getElementById("main-menu").style.display = "none";
      }
    });
    function checkAutoLogin(){
      // 자동 로그인 로직 (필요 시 구현)
    }

    /****************************************
     5) 로그인 / 로그아웃 / 비밀번호 재설정
    *****************************************/
    function login(){
      const emailVal = document.getElementById("loginEmail").value.trim();
      const pwVal = document.getElementById("loginPw").value.trim();
      if(!emailVal || !pwVal){ alert("이메일과 비밀번호를 입력하세요"); return; }
      auth.signInWithEmailAndPassword(emailVal, pwVal)
        .then(() => {})
        .catch(err => { alert("로그인 실패: " + err.message); });
    }
    function logout(){
      if(!confirm("로그아웃 하시겠습니까?")) return;
      auth.signOut();
      currentUser = null; currentUid = null;
      hideAllSections();
      document.getElementById("loginEmail").value = "";
      document.getElementById("loginPw").value = "";
      document.getElementById("login-container").style.display = "block";
      document.getElementById("main-menu").style.display = "none";
    }
    function resetPassword(){
      const emailVal = document.getElementById("loginEmail").value.trim();
      if(!emailVal){ alert("비밀번호 변경을 위해 이메일을 입력하세요."); return; }
      auth.sendPasswordResetEmail(emailVal)
         .then(() => { alert("비밀번호 변경 이메일이 발송되었습니다. 이메일을 확인하세요."); })
         .catch(err => { alert("비밀번호 변경 이메일 발송 실패: " + err.message); });
    }

    /****************************************
     6) 전체 데이터 로드
    *****************************************/
    function loadAllData(){
      const p1 = db.ref("users").once("value").then(snap => {
        if(snap.exists()){
          users = snap.val();
          // 기존 협력 계정에 subCategory가 없으면 기본 "기타"로 지정
          for(const uid in users){
            if(users[uid].role === "협력" && !users[uid].subCategory){
              users[uid].subCategory = "기타";
            }
          }
        }
      });
      const p2 = db.ref("schedules").once("value").then(snap => { if(snap.exists()) schedules = snap.val(); });
      const p3 = db.ref("companyColors").once("value").then(snap => { if(snap.exists()) companyColors = snap.val(); });
      const p4 = db.ref("historyLimit").once("value").then(snap => { if(snap.exists()) historyLimit = snap.val(); });
      const p5 = db.ref("history").once("value").then(snap => {
        if(snap.exists()){
          let temp = [];
          snap.forEach(child => { temp.push({ key: child.key, ...child.val() }); });
          histories = temp;
        }
      });
      return Promise.all([p1, p2, p3, p4, p5]);
    }

    /****************************************
     7) 섹션 전환
    *****************************************/
function showSection(sec){
  hideAllSections();
  if(sec === "monthly"){
    document.getElementById("monthlySection").classList.add("active");
    drawMonthCalendar();
    document.getElementById("btnMonthly").classList.add("active");
  } else if(sec === "weekly"){
    document.getElementById("weeklySection").classList.add("active");
    drawWeekCalendar();
    document.getElementById("btnWeekly").classList.add("active");
  } else if(sec === "status"){
    document.getElementById("statusSection").classList.add("active");
    document.getElementById("btnStatus").classList.add("active");
    // 기본으로 유저 목록 표시
    showStatusPane('user');
  } else if(sec === "admin"){
    if(currentUser.role === "관리자"){
      document.getElementById("adminSection").classList.add("active");
      document.getElementById("btnAdmin").classList.add("active");
      showAdminPane("userList");
    } else { alert("관리자 권한이 없습니다."); }
  }
}


    function hideAllSections(){
      document.getElementById("monthlySection").classList.remove("active");
      document.getElementById("weeklySection").classList.remove("active");
      document.getElementById("adminSection").classList.remove("active");
      document.getElementById("statusSection") && document.getElementById("statusSection").classList.remove("active");
      document.getElementById("btnMonthly").classList.remove("active");
      document.getElementById("btnWeekly").classList.remove("active");
      document.getElementById("btnAdmin").classList.remove("active");
      document.getElementById("btnStatus") && document.getElementById("btnStatus").classList.remove("active");
    }

    /****************************************
     8) 권한별 스케줄 접근
    *****************************************/
    function canAccessSchedule(sch){
      if(!currentUser) return false;
      if(currentUser.role === "관리자" || currentUser.role === "본사") return true;
      const schUser = users[sch.userId];
      return schUser ? (schUser.company === currentUser.company) : false;
    }

    /****************************************
     9) 월간 달력
    *****************************************/
function drawMonthCalendar(){
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  document.getElementById("monthLabel").textContent = `${year}년 ${month+1}월`;

  // 1) 이번 달 정보
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const firstDow = firstDay.getDay();   // 이번 달 1일의 요일(0=일,1=월,...)
  const lastDate = lastDay.getDate();   // 이번 달 마지막 날짜

  // 2) 이전 달 정보 (이전 달의 마지막 날짜 등)
  const prevMonth = (month === 0) ? 11 : (month - 1);
  const prevYear = (month === 0) ? (year - 1) : year;
  const prevLastDate = new Date(prevYear, prevMonth + 1, 0).getDate();

  // 3) 달력 테이블 초기화
  const monthBody = document.getElementById("monthBody");
  monthBody.innerHTML = "";
  let row = document.createElement("tr");

  // 4) 첫 행: 이전 달 날짜 채우기
  //    firstDow만큼 빈 칸이 있었는데, 그 자리에 이전 달 말일들을 넣음
  for(let i = 0; i < firstDow; i++){
    // 예: 요일이 3(수)라면, i=0~2 총 3칸
    //     일,월,화가 이전 달 날짜가 됨
    const pmDay = prevLastDate - (firstDow - (i + 1)); // 역순으로 계산
    const td = document.createElement("td");
    td.innerHTML = `<span class="day-number prev-month">${pmDay}</span>`;

    // 필요하다면 이전 달 날짜도 클릭 시 모달 열리도록 처리
    const pmDateStr = `${prevYear}-${String(prevMonth+1).padStart(2,"0")}-${String(pmDay).padStart(2,"0")}`;
    td.onclick = () => openModal(null, pmDateStr);

    // 시각적으로 구분하기 위해 흐린색
    td.style.color = "#aaa";
    row.appendChild(td);
  }

  // 5) 이번 달 날짜 채우기
  for(let d = 1; d <= lastDate; d++){
    const td = document.createElement("td");
    td.innerHTML = `<span class="day-number">${d}</span>`;
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

    td.onclick = () => openModal(null, dateStr);
    row.appendChild(td);

    // 한 주(7일) 단위로 줄바꿈
    if ((firstDow + d) % 7 === 0) {
      monthBody.appendChild(row);
      row = document.createElement("tr");
    }
  }

  // 6) 마지막 행: 남은 칸에 다음 달 날짜 채우기
  if(row.children.length > 0){
    let nextDay = 1;
    while(row.children.length < 7){
      const td = document.createElement("td");
      td.innerHTML = `<span class="day-number next-month">${nextDay}</span>`;

      // 다음 달의 연/월 계산
      const nmMonth = (month === 11) ? 0 : (month + 1);
      const nmYear = (month === 11) ? (year + 1) : year;
      const nmDateStr = `${nmYear}-${String(nmMonth+1).padStart(2,"0")}-${String(nextDay).padStart(2,"0")}`;
      td.onclick = () => openModal(null, nmDateStr);

      // 역시 흐린색 처리
      td.style.color = "#aaa";
      row.appendChild(td);
      nextDay++;
    }
    monthBody.appendChild(row);
  }

  // 7) 스케줄 바(overlay) 초기화
  document.getElementById("monthOverlay").innerHTML = "";

  // 8) 각 주(테이블 행) 단위로 스케줄 바 표시
  const rows = monthBody.querySelectorAll("tr");
  rows.forEach(r => {
    const cells = r.querySelectorAll("td");
    let rowDates = [];

    // 이번 달 / 이전 달 / 다음 달 날짜 구분하여 rowDates에 담기
    for(let i = 0; i < 7; i++){
      const daySpan = cells[i]?.querySelector(".day-number");
      if(!daySpan) {
        rowDates.push(null);
        continue;
      }

      // prev-month / next-month / current-month 구분
      if(daySpan.classList.contains("prev-month")){
        // 이전 달
        const pmDay = parseInt(daySpan.textContent, 10);
        const dateStr = formatDate(prevYear, (prevMonth + 1), pmDay);
        rowDates.push(dateStr);
      }
      else if(daySpan.classList.contains("next-month")){
        // 다음 달
        const nmDay = parseInt(daySpan.textContent, 10);
        const nmMonth = (month === 11) ? 0 : (month + 1);
        const nmYear = (month === 11) ? (year + 1) : year;
        const dateStr = formatDate(nmYear, (nmMonth + 1), nmDay);
        rowDates.push(dateStr);
      }
      else {
        // 이번 달
        const d = parseInt(daySpan.textContent, 10);
        rowDates.push(formatDate(year, (month+1), d));
      }
    }

    // 현재 행(주)에 해당하는 날짜 구간
    const validD = rowDates.filter(x => x);
    if(validD.length < 1) return;
    const rowStart = validD[0], rowEnd = validD[validD.length - 1];

    // 이 주(행)에 걸쳐있는 스케줄만 추려낸 뒤, 바를 그려준다
    const weekly = schedules.filter(sch => {
      if(!canAccessSchedule(sch)) return false;
      if(document.getElementById("excludeSchedules").checked && (sch.unavailable || sch.status === "cancelled")) return false;
      return (sch.startDate <= rowEnd && sch.endDate >= rowStart);
    });

    let barCount = 0;
    weekly.forEach(sch => {
      // barStart/barEnd는 현재 행(주)에 맞춰 잘라냄
      const barStart = (sch.startDate < rowStart) ? rowStart : sch.startDate;
      const barEnd = (sch.endDate > rowEnd) ? rowEnd : sch.endDate;

      // rowDates 배열에서 시작/끝 인덱스 찾기
      const startIdx = rowDates.findIndex(d => d && d >= barStart);
      let endIdx = -1;
      for(let c = 6; c >= 0; c--){
        if(rowDates[c] && rowDates[c] <= barEnd){
          endIdx = c;
          break;
        }
      }
      if(startIdx < 0 || endIdx < 0) return;

      const startCell = cells[startIdx], endCell = cells[endIdx];
      if(!startCell || !endCell) return;

      // 실제 브라우저 상 위치 계산
      const overlayRect = document.getElementById("monthOverlay").getBoundingClientRect();
      const startRect = startCell.getBoundingClientRect();
      const endRect = endCell.getBoundingClientRect();
      const leftPos = startRect.left - overlayRect.left + 2;
      const rightPos = endRect.right - overlayRect.left - 2;
      const width = rightPos - leftPos;
      const topBase = startRect.top - overlayRect.top + 18;
      const topPos = topBase + (barCount * 18);

// 업체별 색상 결정 로직
const userObj = users[sch.userId] || {};
const comp = userObj.company || "기타";
let c = "#999"; // 기본값
if (companyColors[comp]) {
  if (sch.unavailable) {
    // "서비스 불가 일정"이면 unavailable 색상
    c = companyColors[comp].unavailable || "#ccc";
  }
  else if (sch.status === "cancelled") {
    c = companyColors[comp].cancel || "#f00";
  }
  else if (sch.status === "finalized" || sch.status === "일정 변경 / 최종 확정") {
    c = companyColors[comp].final || "#0f0";
  }
  else {
    c = companyColors[comp].normal || "#999";
  }
}


      // 스케줄 바 생성
      const bar = document.createElement("div");
      bar.className = "schedule-bar";
      bar.style.left = leftPos + "px";
      bar.style.top = topPos + "px";
      bar.style.width = width + "px";
      bar.style.backgroundColor = c;
      bar.textContent = userObj.id + " (" + (userObj.company || "업체 미지정") + ") - " + (sch.lineName || "");

      bar.onclick = (e) => {
        e.stopPropagation();
        openModal(sch.id);
      };
      document.getElementById("monthOverlay").appendChild(bar);
      barCount++;
    });

    // 스케줄 바가 여러 개 겹치면 셀 높이를 늘려줌
    if(barCount > 1){
      const newH = 50 + (barCount - 1) * 18;
      r.querySelectorAll("td").forEach(td => {
        td.style.height = newH + "px";
      });
    }
  });
}

// 이전 달로 이동
function prevMonth(){
  currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
  drawMonthCalendar();
}

// 다음 달로 이동
function nextMonth(){
  currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
  drawMonthCalendar();
}


    /****************************************
     10) 주간 달력
    *****************************************/
    function drawWeekCalendar(){
      const dow = currentWeekDate.getDay();
      const sunday = new Date(currentWeekDate);
      sunday.setDate(currentWeekDate.getDate() - dow);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      document.getElementById("weekLabel").textContent = `${formatDateForLabel(sunday)} ~ ${formatDateForLabel(saturday)}`;
      const weekList = document.getElementById("weekList");
      weekList.innerHTML = "";
      for(let i = 0; i < 7; i++){
        const dDay = new Date(sunday);
        dDay.setDate(sunday.getDate() + i);
        const dateStr = formatDate(dDay.getFullYear(), dDay.getMonth()+1, dDay.getDate());
        const dayBlock = document.createElement("div");
        dayBlock.className = "week-day-block";
        const h4 = document.createElement("h4");
        h4.textContent = formatDateForLabel(dDay);
        dayBlock.appendChild(h4);
        const daySch = schedules.filter(sch => {
          if(!canAccessSchedule(sch)) return false;
          if(document.getElementById("excludeSchedules").checked && (sch.unavailable || sch.status === "cancelled")) return false;
          return (sch.startDate <= dateStr && sch.endDate >= dateStr);
        });
        daySch.forEach(sch => {
          const userObj = users[sch.userId] || {};
          const comp = userObj.company || "기타";
          let c = "#999";
          if(companyColors[comp]){
            if(sch.status === "cancelled"){ c = companyColors[comp].cancel || "#f00"; }
            else if(sch.status === "finalized" || sch.status === "일정 변경 / 최종 확정"){ c = companyColors[comp].final || "#0f0"; }
            else { c = companyColors[comp].normal || "#999"; }
          }
          const item = document.createElement("div");
          item.className = "schedule-week-item";
          item.onclick = (e)=>{ e.stopPropagation(); openModal(sch.id); };
          const bar = document.createElement("div");
          bar.className = "schedule-color-bar";
          bar.style.backgroundColor = c;
          const content = document.createElement("div");
          content.className = "schedule-week-content";
          content.textContent = `${userObj.company || "(업체 미지정)"} (${sch.startDate}~${sch.endDate}) Ship:${sch.lineName||''}, IMO:${sch.imoNo||''}, Hull:${sch.hullNo||''}, 지역:${sch.regionName||''}`;
          item.appendChild(bar);
          item.appendChild(content);
          dayBlock.appendChild(item);
        });
        dayBlock.onclick = () => openModal(null, dateStr);
        weekList.appendChild(dayBlock);
      }
    }
    function prevWeek(){ currentWeekDate.setDate(currentWeekDate.getDate()-7); drawWeekCalendar(); }
    function nextWeek(){ currentWeekDate.setDate(currentWeekDate.getDate()+7); drawWeekCalendar(); }

    /****************************************
     11) 스케줄 모달
    *****************************************/
function openModal(scheduleId = null, dateStr = null){
  editingScheduleId = scheduleId;
  document.getElementById("modal-background").style.display = "block";

  const userRow = document.getElementById("modalUserRow");
  const sel = document.getElementById("modalUserSelect");
  const extraContainer = document.getElementById("additionalEngineerRows");
  extraContainer.innerHTML = "";

  const btnDelete = document.getElementById("btnDeleteSchedule");
  const btnCancel = document.getElementById("btnCancelSchedule");
  const btnFinalize = document.getElementById("btnFinalizeSchedule");
  const btnSave = document.getElementById("btnSaveSchedule");

  // 초기 상태 설정
  btnDelete.style.display = "none";
  btnCancel.style.display = "none";
  btnFinalize.style.display = "none";
  document.getElementById("scheduleStatusLabel").textContent = "";
  document.getElementById("modalIMONo").value = "";
  document.getElementById("modalLine").value = "";
  document.getElementById("modalHullNo").value = "";
  document.getElementById("modalRegion").value = "";
  document.getElementById("modalDetails").value = "";
  document.getElementById("modalMessage").value = "";
  document.getElementById("modalUnavailable").checked = false;

  // 1) 권한별 엔지니어/담당자/체크박스 표시
  if (currentUser.role === "관리자" || currentUser.role === "본사") {
    // 관리자/본사: 엔지니어 선택 전체, 본사 담당자 전체, "기타 협력사 포함" 체크박스 보이기
    userRow.style.display = "";
    buildEngineerSelectOptions(sel); // 필터 없음
    buildManagerSelectOptions(document.getElementById("modalManagerSelect"));
    document.getElementById("includeOtherPartnersRow").style.display = "";
    document.getElementById("includeOtherPartnersCheckbox").checked = false;
    document.getElementById("includeOtherPartnersCheckbox").onchange = function(){
    updateEngineerLists();
    };
  } else if (currentUser.role === "협력") {
    // 협력: 엔지니어 선택은 "자신의 업체만", 본사 담당자 전체, "기타 협력사 포함" 체크박스는 숨김
    userRow.style.display = "";
    buildEngineerSelectOptions(sel, null, currentUser.company);
    buildManagerSelectOptions(document.getElementById("modalManagerSelect"));
    document.getElementById("includeOtherPartnersRow").style.display = "none";
  } else {
    // 그 외 권한: 엔지니어/본사 담당자/체크박스 전부 숨김
    userRow.style.display = "none";
    buildEngineerSelectOptions(sel, currentUid);
    document.getElementById("modalManagerSelect").innerHTML = "<option value=''>없음</option>";
    document.getElementById("includeOtherPartnersRow").style.display = "none";
  }

  // 2) scheduleId 유무에 따라 (편집 모드 / 새 스케줄)
  if (scheduleId) {
    // 편집 모드
    const sch = schedules.find(x => x.id === scheduleId);
    if (!sch) return;

    if (!canAccessSchedule(sch)) {
      alert("권한 없음");
      document.getElementById("modal-background").style.display = "none";
      return;
    }

    // 기존 값 채우기
    document.getElementById("modalStartDate").value = sch.startDate;
    document.getElementById("modalEndDate").value   = sch.endDate;
    document.getElementById("modalIMONo").value     = sch.imoNo || "";
    document.getElementById("modalLine").value      = sch.lineName || "";
    document.getElementById("modalHullNo").value    = sch.hullNo || "";
    document.getElementById("modalRegion").value    = sch.regionName || "";
    document.getElementById("modalDetails").value   = sch.details || "";
    document.getElementById("modalMessage").value   = sch.message || "";
    document.getElementById("modalUnavailable").checked = !!sch.unavailable;

    // 본사 담당자
    buildManagerSelectOptions(document.getElementById("modalManagerSelect"), sch.managerId);

    // 상태 표시
    if      (sch.status === "cancelled")                document.getElementById("scheduleStatusLabel").textContent = "일정 취소";
    else if (sch.status === "finalized")                document.getElementById("scheduleStatusLabel").textContent = "최종 확정";
    else if (sch.status === "일정 변경 / 최종 확정")    document.getElementById("scheduleStatusLabel").textContent = "일정 변경 / 최종 확정";
    else                                                document.getElementById("scheduleStatusLabel").textContent = "일정 변경";

    // 버튼 표시
    btnSave.textContent = "일정 변경";
    if (currentUser.role === "관리자" || currentUser.role === "본사") {
      userRow.style.display = "";
      buildEngineerSelectOptions(sel, sch.userId);
      btnDelete.style.display = "inline-block";
      btnCancel.style.display = "inline-block";
      btnFinalize.style.display = "inline-block";
    } else {
      userRow.style.display = "none";
      btnCancel.style.display   = "inline-block";
      btnFinalize.style.display = "inline-block";
    }
  } else {
    // 새 스케줄 등록
    document.getElementById("modalStartDate").value = dateStr || "";
    document.getElementById("modalEndDate").value   = dateStr || "";
    document.getElementById("scheduleStatusLabel").textContent = "일정등록";
    btnSave.textContent = "일정 추가";
  }

  // 3) 가용 엔지니어 갱신
  updateAvailableEngineers(
    document.getElementById("modalStartDate").value, 
    document.getElementById("modalEndDate").value
  );
updateAssignedEngineers(
  document.getElementById("modalStartDate").value,
  document.getElementById("modalEndDate").value
);
}
function updateEngineerLists() {
  var sDate = document.getElementById("modalStartDate").value;
  var eDate = document.getElementById("modalEndDate").value;
  updateAvailableEngineers(sDate, eDate);
  updateAssignedEngineers(sDate, eDate);
}

    function closeModal(){
      document.getElementById("modal-background").style.display = "none";
      editingScheduleId = null;
    }
    function deleteSchedule(){
      if (!editingScheduleId) return;
      if (!confirm("정말 삭제하시겠습니까?")) return;
      const idx = schedules.findIndex(x => x.id === editingScheduleId);
      if (idx < 0) return;
      const delObj = schedules[idx];
      schedules.splice(idx, 1);
      db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
      .then(() => {
        recordHistory("삭제", currentUid, delObj);
        alert("삭제 완료");
        closeModal();
        refreshCalendar();
      })
      .catch(err => {
        console.error("삭제 에러:", err);
        alert("삭제 중 에러 발생: " + err.message);
      });
    }

    /****************************************
     12) 히스토리 기록
    *****************************************/
    function recordHistory(actionType, userUid, newSchedule, oldSchedule = null){
      const userName = users[userUid] ? users[userUid].id : userUid;
      const data = {
        action: actionType,
        user: userName,
        timestamp: new Date().toISOString(),
        oldStartDate: oldSchedule ? oldSchedule.startDate : "",
        oldEndDate: oldSchedule ? oldSchedule.endDate : "",
        newStartDate: newSchedule.startDate || "",
        newEndDate: newSchedule.endDate || ""
      };
      const newRef = db.ref("history").push();
      return newRef.set(data).then(() => { return enforceHistoryLimit(); });
    }
    function enforceHistoryLimit(){
      return db.ref("history").once("value").then(snap => {
        let arr = [];
        snap.forEach(child => { arr.push({ key: child.key, ...child.val() }); });
        arr.sort((a, b) => a.key.localeCompare(b.key));
        const exceed = arr.length - historyLimit;
        if(exceed > 0){
          let tasks = [];
          for(let i = 0; i < exceed; i++){ tasks.push(db.ref("history/" + arr[i].key).remove()); }
          return Promise.all(tasks);
        }
      });
    }

    /****************************************
     13) 일정 취소 / 최종 확정
    *****************************************/
    function cancelSchedule(){
      if(!editingScheduleId) return;
      let reason = prompt("일정 취소 사유를 입력하세요:");
      if(!reason){ alert("취소 사유가 필요합니다."); return; }
      const idx = schedules.findIndex(x => x.id === editingScheduleId);
      if(idx < 0) return;
      if(!canAccessSchedule(schedules[idx])){ alert("권한 없음"); return; }
      const oldSch = { startDate: schedules[idx].startDate, endDate: schedules[idx].endDate };
      schedules[idx].cancelReason = reason;
      schedules[idx].status = "cancelled";
      db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
      .then(() => {
        recordHistory("일정 취소", currentUid, schedules[idx], oldSch);
        alert("일정 취소 완료");
        if(confirm("이메일을 발송할까요?")){ sendEmailNotification(); }
        closeModal();
        refreshCalendar();
      });
    }
    function finalizeSchedule(){
      if(!editingScheduleId) return;
      if(!confirm("이 일정을 최종 확정하시겠습니까?")) return;
      const idx = schedules.findIndex(x => x.id === editingScheduleId);
      if(idx < 0) return;
      if(!canAccessSchedule(schedules[idx])){ alert("권한 없음"); return; }
      const oldSch = { startDate: schedules[idx].startDate, endDate: schedules[idx].endDate };
      schedules[idx].status = "finalized";
      db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
      .then(() => {
        recordHistory("최종 확정", currentUid, schedules[idx], oldSch);
        alert("일정 최종 확정");
        if(confirm("이메일을 발송할까요?")){ sendEmailNotification(); }
        closeModal();
        refreshCalendar();
      });
    }

    /****************************************
     14) 일정 추가 / 변경 / 삭제
    *****************************************/
    function saveSchedule(){
      const sDate = document.getElementById("modalStartDate").value;
      const eDate = document.getElementById("modalEndDate").value;
      const imoNo = document.getElementById("modalIMONo").value.trim();
      const shipName = document.getElementById("modalLine").value.trim();
      const hullNo = document.getElementById("modalHullNo").value.trim();
      const regionVal = document.getElementById("modalRegion").value.trim();
      const workContent = document.getElementById("modalDetails").value.trim();
      const transferMsg = document.getElementById("modalMessage").value.trim();
      const isUnavailable = document.getElementById("modalUnavailable").checked;
      if(!sDate || !eDate){ alert("시작/종료일을 입력하세요"); return; }
      if(sDate > eDate){ alert("종료일이 시작일보다 빠릅니다."); return; }
      let mainUserId = (document.getElementById("modalUserRow").style.display !== "none") ? document.getElementById("modalUserSelect").value : currentUid;
      const extraContainer = document.getElementById("additionalEngineerRows");
      const extraSelects = extraContainer.querySelectorAll("select");
      const managerId = document.getElementById("modalManagerSelect").value;
      
      if(editingScheduleId){
        var finalizeAnswer = confirm("일정변경 후에 최종 확정 할까요?");
        const idx = schedules.findIndex(x => x.id === editingScheduleId);
        if(idx > -1){
          if(!canAccessSchedule(schedules[idx])){ alert("수정 권한 없음"); return; }
          const oldSch = { startDate: schedules[idx].startDate, endDate: schedules[idx].endDate };
          schedules[idx].userId = mainUserId;
          schedules[idx].startDate = sDate;
          schedules[idx].endDate = eDate;
          schedules[idx].imoNo = imoNo;
          schedules[idx].lineName = shipName;
          schedules[idx].hullNo = hullNo;
          schedules[idx].regionName = regionVal;
          schedules[idx].details = workContent;
          schedules[idx].message = transferMsg;
          schedules[idx].unavailable = isUnavailable;
          schedules[idx].managerId = managerId;
          if(finalizeAnswer){
            schedules[idx].status = "일정 변경 / 최종 확정";
          } else {
            schedules[idx].status = "일정 변경";
          }
          extraSelects.forEach(sel => {
            const uid = sel.value;
            if(uid){
              const newId = Date.now() + Math.floor(Math.random() * 100000);
              schedules.push({
                id: newId,
                userId: uid,
                startDate: sDate,
                endDate: eDate,
                imoNo: imoNo,
                lineName: shipName,
                hullNo: hullNo,
                regionName: regionVal,
                details: workContent,
                message: transferMsg,
                unavailable: isUnavailable,
                managerId: managerId,
                status: finalizeAnswer ? "일정 변경 / 최종 확정" : "일정 변경"
              });
            }
          });
          db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
          .then(() => {
            recordHistory("일정 변경", currentUid, schedules[idx], oldSch);
            if(finalizeAnswer){
              alert("일정이 변경 및 최종 확정되었습니다.");
            } else {
              alert("일정이 변경되었습니다.");
            }
            if(confirm("이메일을 발송할까요?")){ sendEmailNotification(); }
            closeModal();
            refreshCalendar();
          });
        }
      } else {
        const newId = Date.now();
        const newSch = {
          id: newId,
          userId: mainUserId,
          startDate: sDate,
          endDate: eDate,
          imoNo: imoNo,
          lineName: shipName,
          hullNo: hullNo,
          regionName: regionVal,
          details: workContent,
          message: transferMsg,
          unavailable: isUnavailable,
          managerId: managerId,
          status: "일정확정대기"
        };
        schedules.push(newSch);
        extraSelects.forEach(sel => {
          const uid = sel.value;
          if(uid){
            const newId2 = Date.now() + Math.floor(Math.random() * 100000);
            schedules.push({
              id: newId2,
              userId: uid,
              startDate: sDate,
              endDate: eDate,
              imoNo: imoNo,
              lineName: shipName,
              hullNo: hullNo,
              regionName: regionVal,
              details: workContent,
              message: transferMsg,
              unavailable: isUnavailable,
              managerId: managerId,
              status: "일정확정대기"
            });
          }
        });
        db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
        .then(() => {
          recordHistory("추가", currentUid, newSch);
          alert("새 일정이 추가되었습니다.");
          closeModal();
          refreshCalendar();
        });
      }
    }

    /****************************************
     15) 가용 엔지니어 계산 및 select 옵션 구축
    *****************************************/
    function updateAvailableEngineers(sDate, eDate){
      const listDiv = document.getElementById("availableEngineersList");
      if(!sDate || !eDate){
        listDiv.textContent = "시작/종료일을 먼저 입력하세요.";
        return;
      }
      let includeOther = false;
      const checkbox = document.getElementById("includeOtherPartnersCheckbox");
      if(checkbox) { includeOther = checkbox.checked; }
      const available = [];
      for(const uid in users){
        if(users[uid].role === "협력"){
          // 협력 사용자는 본인 회사의 협력자만 보임
          if(currentUser.role === "협력" && users[uid].company !== currentUser.company) continue;
          let subCategory = users[uid].subCategory || "기타";
          if(subCategory !== "주요" && !includeOther) continue;
          const conflict = schedules.some(sch => {
             if(sch.userId !== uid) return false;
             if(sch.status === "cancelled") return false;
             return (sch.startDate <= eDate && sch.endDate >= sDate);
          });
          if(!conflict) available.push(uid);
        }
      }
      if(available.length < 1){
        listDiv.textContent = "가용 엔지니어 없음";
      } else {
        listDiv.textContent = available.map(uid => users[uid].id + " (" + (users[uid].company || "업체 미지정") + ")").join(", ");
      }
    }
function updateAssignedEngineers(sDate, eDate) {
  const listDiv = document.getElementById("assignedEngineersList");
  if (!sDate || !eDate) {
    listDiv.textContent = "시작/종료일을 먼저 입력하세요.";
    return;
  }
  let includeOther = false;
  const checkbox = document.getElementById("includeOtherPartnersCheckbox");
  if (checkbox) { includeOther = checkbox.checked; }
  
  const assigned = [];
  for (const uid in users) {
    if (users[uid].role === "협력") {
      // 협력 사용자의 경우, 자신의 회사에 속한 협력자만 보임
      if (currentUser.role === "협력" && users[uid].company !== currentUser.company) continue;
      let subCategory = users[uid].subCategory || "기타";
      // "주요" 협력사만 기본 표시, 체크박스가 체크되면 기타도 포함
      if (subCategory !== "주요" && !includeOther) continue;
      // 해당 기간에 이미 일정이 있는 경우
      const conflict = schedules.some(sch => {
        if (sch.userId !== uid) return false;
        if (sch.status === "cancelled") return false;
        return (sch.startDate <= eDate && sch.endDate >= sDate);
      });
      if (conflict) assigned.push(uid);
    }
  }
  if (assigned.length < 1) {
    listDiv.textContent = "배정 완료된 엔지니어 없음";
  } else {
    listDiv.textContent = assigned.map(uid => users[uid].id + " (" + (users[uid].company || "업체 미지정") + ")").join(", ");
  }
}


function buildEngineerSelectOptions(selectEl, selectedValue = null, filterCompany = null){
  selectEl.innerHTML = "";
  let engineerOptions = [];
  for(const uid in users){
    if(users[uid].role === "협력"){
      if(filterCompany && users[uid].company.trim().toLowerCase() !== filterCompany.trim().toLowerCase()) continue;
      engineerOptions.push({ uid: uid, name: users[uid].id || "NONAME", company: users[uid].company || "업체 미지정" });
    }
  }
  engineerOptions.sort((a, b) => a.company.localeCompare(b.company));
  engineerOptions.forEach(optData => {
    const opt = document.createElement("option");
    opt.value = optData.uid;
    opt.textContent = `${optData.name} (${optData.company})`;
    selectEl.appendChild(opt);
  });
  if(selectedValue){
    for(let i = 0; i < selectEl.options.length; i++){
      if(selectEl.options[i].value === selectedValue){ 
        selectEl.selectedIndex = i; 
        break; 
      }
    }
  }
}


    function buildManagerSelectOptions(selectEl, selectedValue = null){
      selectEl.innerHTML = "";
      let hasOption = false;
      for(const uid in users){
        if(users[uid].role === "본사" || users[uid].role === "관리자"){
          const opt = document.createElement("option");
          opt.value = uid;
          opt.textContent = users[uid].id || "담당자";
          selectEl.appendChild(opt);
          hasOption = true;
        }
      }
      if(!hasOption){ selectEl.innerHTML = "<option value=''>없음</option>"; }
      if(selectedValue){
         for(let i = 0; i < selectEl.options.length; i++){
           if(selectEl.options[i].value === selectedValue){ selectEl.selectedIndex = i; break; }
         }
      }
    }
function addEngineerRow(){
  const container = document.getElementById("additionalEngineerRows");
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "4px";
  row.style.marginTop = "4px";
  const newSelect = document.createElement("select");
  // 협력사 계정이면 자신의 회사에 속한 엔지니어만 표시
  if(currentUser.role === "협력"){
    buildEngineerSelectOptions(newSelect, null, currentUser.company);
  } else {
    buildEngineerSelectOptions(newSelect);
  }
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "-";
  removeBtn.style.backgroundColor = "#c0392b";
  removeBtn.style.color = "#fff";
  removeBtn.onclick = () => { container.removeChild(row); };
  row.appendChild(newSelect);
  row.appendChild(removeBtn);
  container.insertBefore(row, container.firstChild);
}



    /****************************************
     16) 관리자 페이지: 유저 목록, 수정, 등록, 스케줄 목록, 업체 색상 관리, 히스토리
    *****************************************/
    function showAdminPane(pane){
      document.getElementById("adminUserListPane").classList.remove("active");
      document.getElementById("adminUserRegisterPane").classList.remove("active");
      document.getElementById("adminScheduleListPane").classList.remove("active");
      document.getElementById("adminCompanyColorPane").classList.remove("active");
      document.getElementById("adminHistoryPane").classList.remove("active");
      if(pane === "userList"){
        document.getElementById("adminUserListPane").classList.add("active");
        drawUserList();
      } else if(pane === "userRegister"){
        document.getElementById("adminUserRegisterPane").classList.add("active");
      } else if(pane === "scheduleList"){
        document.getElementById("adminScheduleListPane").classList.add("active");
        drawScheduleList();
      } else if(pane === "companyColor"){
        document.getElementById("adminCompanyColorPane").classList.add("active");
        drawCompanyColorList();
      } else if(pane === "history"){
        db.ref("history").once("value").then(snap => {
          let temp = [];
          snap.forEach(child => { temp.push({ key: child.key, ...child.val() }); });
          histories = temp;
          drawHistoryList();
          document.getElementById("adminHistoryPane").classList.add("active");
        });
      }
    }
function drawUserList(){
  const filterSelect = document.getElementById("userCompanyFilter");
  const prevSelected = filterSelect.value;
  filterSelect.innerHTML = "<option value=''>전체</option>";
  let companies = new Set();
  for (const uid in users) {
    const comp = users[uid].company || "";
    if(comp) companies.add(comp);
  }
  companies.forEach(comp => {
    const option = document.createElement("option");
    option.value = comp;
    option.textContent = comp;
    filterSelect.appendChild(option);
  });
  if(prevSelected && Array.from(filterSelect.options).some(opt => opt.value === prevSelected)){
    filterSelect.value = prevSelected;
  }
  const selectedCompany = filterSelect.value;
  const tbody = document.getElementById("adminUserListBody");
  tbody.innerHTML = "";
  
  // users 객체를 배열로 변환 후, 회사명을 기준으로 오름차순 정렬
  let userArray = [];
  for(const uid in users) {
    userArray.push({ uid: uid, user: users[uid] });
  }
  userArray.sort((a, b) => {
    const compA = a.user.company ? a.user.company.toLowerCase() : "";
    const compB = b.user.company ? b.user.company.toLowerCase() : "";
    if(compA < compB) return -1;
    if(compA > compB) return 1;
    return 0;
  });
  
  // 정렬된 배열을 기준으로 테이블 행 생성
  userArray.forEach(item => {
    const uid = item.uid;
    const u = item.user;
    if(selectedCompany && u.company !== selectedCompany) return;
    
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = u.id || "(no name)";
    const tdEmail = document.createElement("td");
    tdEmail.textContent = u.email || "";
    const tdRole = document.createElement("td");
    tdRole.textContent = u.role;
    const tdSub = document.createElement("td");
    tdSub.textContent = (u.role === "협력") ? (u.subCategory || "기타") : "";
    const tdComp = document.createElement("td");
    tdComp.textContent = u.company || "";
    const tdEdit = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "admin-btn";
    editBtn.textContent = "수정";
    editBtn.onclick = () => openUserEditModal(uid);
    tdEdit.appendChild(editBtn);
    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "admin-btn";
    delBtn.textContent = "삭제";
    delBtn.onclick = () => deleteUser(uid);
    tdDel.appendChild(delBtn);
    
    tr.appendChild(tdName);
    tr.appendChild(tdEmail);
    tr.appendChild(tdRole);
    tr.appendChild(tdSub);
    tr.appendChild(tdComp);
    tr.appendChild(tdEdit);
    tr.appendChild(tdDel);
    
    tbody.appendChild(tr);
  });
}
// 필터 옵션 채우기 (유저 목록)
function populateStatusUserFilter(){
  const filterSelect = document.getElementById("statusUserCompanyFilter");
  filterSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "전체";
  filterSelect.appendChild(allOpt);
  
  // users 객체를 배열로 변환 후, 각 유저의 company 값을 추출 (공백제거)
  let companies = Object.values(users)
    .map(u => u.company ? u.company.trim() : "")
    .filter(comp => comp !== "");
  
  // 중복 제거
  companies = Array.from(new Set(companies));
  
  // 오름차순 정렬 (localeCompare 사용)
  companies.sort((a, b) => a.localeCompare(b));
  
  console.log("Companies found:", companies); // 디버깅: 콘솔에 출력
  
  companies.forEach(comp => {
    const option = document.createElement("option");
    option.value = comp;
    option.textContent = comp;
    filterSelect.appendChild(option);
  });
}




    function openUserEditModal(uid){
      const u = users[uid];
      if(!u) return;
      document.getElementById("modalUserEditBg").style.display = "block";
      document.getElementById("userEditUid").value = uid;
      document.getElementById("userEditName").value = u.id || "";
      document.getElementById("userEditEmail").value = u.email || "";
      document.getElementById("userEditRole").value = u.role;
      document.getElementById("userEditCompany").value = u.company || "";
      if(u.role === "협력"){
        document.getElementById("userEditSubCategoryRow").style.display = "";
        document.getElementById("userEditSubCategory").value = u.subCategory || "기타";
      } else {
        document.getElementById("userEditSubCategoryRow").style.display = "none";
      }
    }
    function closeUserEditModal(){ document.getElementById("modalUserEditBg").style.display = "none"; }
    function applyUserEdit(){
      const uid = document.getElementById("userEditUid").value;
      const newName = document.getElementById("userEditName").value.trim();
      const role = document.getElementById("userEditRole").value;
      const comp = document.getElementById("userEditCompany").value.trim();
      if(!uid){ alert("잘못된 UID"); return; }
      if(!users[uid]) return;
      users[uid].id = newName;
      users[uid].role = role;
      users[uid].company = comp;
      if(role === "협력"){
        let subCategory = document.getElementById("userEditSubCategory").value;
        users[uid].subCategory = subCategory;
      }
      db.ref("users/" + uid).set(users[uid]).then(() => {
        alert("유저 수정 완료");
        closeUserEditModal();
        loadAllData().then(() => drawUserList());
      });
    }
    function deleteUserFromModal(){
      const uid = document.getElementById("userEditUid").value;
      if(!confirm("유저 삭제?")) return;
      db.ref("users/" + uid).remove().then(() => {
        schedules = schedules.filter(s => s.userId !== uid);
        db.ref("schedules").set(schedules).then(() => {
          alert("삭제 완료");
          closeUserEditModal();
          loadAllData().then(() => drawUserList());
        });
      });
    }
    function deleteUser(uid){
      if(!confirm(uid + " 유저 삭제?")) return;
      db.ref("users/" + uid).remove().then(() => {
        schedules = schedules.filter(s => s.userId !== uid);
        db.ref("schedules").set(schedules).then(() => {
          alert("삭제 완료");
          loadAllData().then(() => drawUserList());
        });
      });
    }
    function createUser(){
      const role = document.getElementById("adminRegisterRole").value;
      const userName = document.getElementById("adminRegisterName").value.trim();
      const newEmail = document.getElementById("adminRegisterEmail").value.trim();
      const newPw = document.getElementById("adminRegisterPw").value.trim();
      const newComp = document.getElementById("adminRegisterCompany").value.trim() || "";
      let subCategory = "";
      if(role === "협력"){
         subCategory = document.getElementById("adminRegisterSubCategory").value;
      }
      if(!userName || !newEmail || !newPw){ alert("이름/이메일/비밀번호는 필수 입력입니다."); return; }
      auth.createUserWithEmailAndPassword(newEmail, newPw)
        .then(cred => {
          const uid = cred.user.uid;
          const userData = { id: userName, email: newEmail, role: role, company: newComp };
          if(role === "협력"){
              userData.subCategory = subCategory;
          }
          return db.ref("users/" + uid).set(userData);
        })
        .then(() => {
          alert("유저 등록 완료");
          document.getElementById("adminRegisterName").value = "";
          document.getElementById("adminRegisterEmail").value = "";
          document.getElementById("adminRegisterPw").value = "";
          document.getElementById("adminRegisterCompany").value = "";
          loadAllData().then(() => { showAdminPane("userList"); });
        })
        .catch(err => { alert("유저 등록 실패: " + err.message); });
    }
    function drawScheduleList(){
      const tbody = document.getElementById("adminScheduleListBody");
      tbody.innerHTML = "";
      let qStart = document.getElementById("adminQueryStart").value;
      let qEnd = document.getElementById("adminQueryEnd").value;
      if(!qStart || !qEnd){
        const today = new Date();
        qStart = formatDate(today.getFullYear(), today.getMonth()+1, today.getDate());
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth()+1);
        qEnd = formatDate(nextMonth.getFullYear(), nextMonth.getMonth()+1, nextMonth.getDate());
        document.getElementById("adminQueryStart").value = qStart;
        document.getElementById("adminQueryEnd").value = qEnd;
      }
      const filtered = schedules.filter(sch => sch.startDate <= qEnd && sch.endDate >= qStart);
      filtered.forEach(sch => {
        const tr = document.createElement("tr");
        const tdCompany = document.createElement("td");
        const userObj = users[sch.userId] || {};
        tdCompany.textContent = userObj.company || "(업체 미지정)";
        tr.appendChild(tdCompany);
        const tdEngineer = document.createElement("td");
        tdEngineer.textContent = userObj.id || "";
        tr.appendChild(tdEngineer);
        const tdPeriod = document.createElement("td");
        tdPeriod.textContent = `${sch.startDate} ~ ${sch.endDate}`;
        tr.appendChild(tdPeriod);
        const tdShipName = document.createElement("td");
        tdShipName.textContent = sch.lineName || "";
        tr.appendChild(tdShipName);
        const tdIMONo = document.createElement("td");
        tdIMONo.textContent = sch.imoNo || "";
        tr.appendChild(tdIMONo);
        const tdHullNo = document.createElement("td");
        tdHullNo.textContent = sch.hullNo || "";
        tr.appendChild(tdHullNo);
        const tdRegion = document.createElement("td");
        tdRegion.textContent = sch.regionName || "";
        tr.appendChild(tdRegion);
        const tdManager = document.createElement("td");
        if(sch.managerId && users[sch.managerId]){
          tdManager.textContent = users[sch.managerId].id || "";
        } else { tdManager.textContent = ""; }
        tr.appendChild(tdManager);
        const tdDetails = document.createElement("td");
        tdDetails.textContent = sch.details || "";
        tr.appendChild(tdDetails);
        const tdUnavailable = document.createElement("td");
        tdUnavailable.style.textAlign = "left";
        tdUnavailable.textContent = sch.unavailable ? "서비스 불가" : "";
        tr.appendChild(tdUnavailable);
        const tdEdit = document.createElement("td");
        const btnEdit = document.createElement("button");
        btnEdit.className = "admin-btn";
        btnEdit.textContent = "수정";
        btnEdit.onclick = () => editAdminSchedule(sch.id);
        tdEdit.appendChild(btnEdit);
        tr.appendChild(tdEdit);
        const tdDelete = document.createElement("td");
        const btnDelete = document.createElement("button");
        btnDelete.className = "admin-btn";
        btnDelete.textContent = "삭제";
        btnDelete.onclick = () => deleteAdminSchedule(sch.id);
        tdDelete.appendChild(btnDelete);
        tr.appendChild(tdDelete);
        tbody.appendChild(tr);
      });
    }
    function editAdminSchedule(sid){
      const sch = schedules.find(x => x.id === sid);
      if(!sch) return;
      const newUid = prompt("사용자 UID", sch.userId);
      if(newUid === null) return;
      const newSDate = prompt("시작일(YYYY-MM-DD)", sch.startDate);
      if(newSDate === null) return;
      const newEDate = prompt("종료일(YYYY-MM-DD)", sch.endDate);
      if(newEDate === null) return;
      const newIMONo = prompt("IMO No.", sch.imoNo || "");
      if(newIMONo === null) return;
      const newShipName = prompt("Ship Name", sch.lineName || "");
      if(newShipName === null) return;
      const newHullNo = prompt("Hull No.", sch.hullNo || "");
      if(newHullNo === null) return;
      const newReg = prompt("지역", sch.regionName || "");
      if(newReg === null) return;
      const newDet = prompt("상세내용", sch.details || "");
      if(newDet === null) return;
      const newManagerId = prompt("본사 담당자", sch.managerId || "");
      if(newManagerId === null) return;
      const newUnavail = confirm("서비스 불가 일정?");
      if(newSDate > newEDate){ alert("종료일이 시작일보다 빠릅니다."); return; }
      sch.userId = newUid;
      sch.startDate = newSDate;
      sch.endDate = newEDate;
      sch.imoNo = newIMONo;
      sch.lineName = newShipName;
      sch.hullNo = newHullNo;
      sch.regionName = newReg;
      sch.details = newDet;
      sch.managerId = newManagerId;
      sch.unavailable = newUnavail;
      if(!sch.status) sch.status = "normal";
      db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
      .then(() => {
        recordHistory("일정 변경", currentUid, sch);
        alert("수정 완료");
        drawScheduleList();
        refreshCalendar();
      });
    }
    function deleteAdminSchedule(sid){
      if(!confirm("스케줄 삭제?")) return;
      const idx = schedules.findIndex(x => x.id === sid);
      if(idx < 0) return;
      const delObj = schedules[idx];
      schedules.splice(idx, 1);
      db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
      .then(() => {
        recordHistory("삭제", currentUid, delObj);
        alert("삭제 완료");
        drawScheduleList();
        refreshCalendar();
      });
    }

    /****************************************
     17) 업체 색상 관리
    *****************************************/
/* 업체 색상 관리 테이블 그리기 */
function drawCompanyColorList(){
  const tbody = document.getElementById("companyColorBody");
  tbody.innerHTML = "";

  // 업체명 셀렉트 박스 갱신
  const sel = document.getElementById("selectCompanyName");
  sel.innerHTML = "";

  let compSet = {};
  // users에 있는 모든 company, companyColors에 등록된 모든 company 수집
  for(const uid in users){
    compSet[ users[uid].company || "기타" ] = true;
  }
  for(const cName in companyColors){
    compSet[cName] = true;
  }

  // selectCompanyName에 옵션 추가
  for(const cName in compSet){
    const opt = document.createElement("option");
    opt.value = cName;
    opt.textContent = cName;
    sel.appendChild(opt);
  }

  // 업체별 색상 목록 테이블
  for(const cName in companyColors){
    const cVal = companyColors[cName];
    const tr = document.createElement("tr");

    // 1) 업체명
    const tdName = document.createElement("td");
    tdName.textContent = cName;
    tr.appendChild(tdName);

    // 2) 기본(normal)
    const tdNormal = document.createElement("td");
    const divN = document.createElement("div");
    divN.style.width = "30px"; 
    divN.style.height = "15px"; 
    divN.style.margin = "0 auto";
    divN.style.background = cVal.normal || "#999";
    tdNormal.appendChild(divN);
    tr.appendChild(tdNormal);

    // 3) 취소(cancel)
    const tdCancel = document.createElement("td");
    const divC = document.createElement("div");
    divC.style.width = "30px"; 
    divC.style.height = "15px"; 
    divC.style.margin = "0 auto";
    divC.style.background = cVal.cancel || "#f00";
    tdCancel.appendChild(divC);
    tr.appendChild(tdCancel);

    // 4) 확정(final)
    const tdFinal = document.createElement("td");
    const divF = document.createElement("div");
    divF.style.width = "30px"; 
    divF.style.height = "15px"; 
    divF.style.margin = "0 auto";
    divF.style.background = cVal.final || "#0f0";
    tdFinal.appendChild(divF);
    tr.appendChild(tdFinal);

    // 5) 불가(unavailable)
    const tdUnavail = document.createElement("td");
    const divU = document.createElement("div");
    divU.style.width = "30px";
    divU.style.height = "15px";
    divU.style.margin = "0 auto";
    // 등록된 값이 없으면 #ccc 기본값 사용
    divU.style.background = cVal.unavailable || "#ccc";
    tdUnavail.appendChild(divU);
    tr.appendChild(tdUnavail);

    // 6) 삭제 버튼
    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "admin-btn";
    delBtn.textContent = "삭제";
    delBtn.onclick = () => deleteCompanyColor(cName);
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    tbody.appendChild(tr);
  }
}

/* select 박스에서 업체 선택 시, 기존 색상 불러오기 */
function onSelectCompanyNameChange(){
  const cName = document.getElementById("selectCompanyName").value;
  if(!cName) return;
  const rec = companyColors[cName];
  if(rec){
    document.getElementById("inputCompanyColorNormal").value      = rec.normal      || "#999999";
    document.getElementById("inputCompanyColorCancel").value      = rec.cancel      || "#ff0000";
    document.getElementById("inputCompanyColorFinal").value       = rec.final       || "#00ff00";
    document.getElementById("inputCompanyColorUnavailable").value = rec.unavailable || "#cccccc";
  } else {
    // 새 업체면 기본값 세팅
    document.getElementById("inputCompanyColorNormal").value      = "#999999";
    document.getElementById("inputCompanyColorCancel").value      = "#ff0000";
    document.getElementById("inputCompanyColorFinal").value       = "#00ff00";
    document.getElementById("inputCompanyColorUnavailable").value = "#cccccc";
  }
}

/* 업체 색상 추가/수정 */
function saveCompanyColor(){
  const name = document.getElementById("selectCompanyName").value.trim();
  if(!name){ 
    alert("업체명을 선택하세요");
    return;
  }
  const nCol = document.getElementById("inputCompanyColorNormal").value.trim()      || "#999999";
  const cCol = document.getElementById("inputCompanyColorCancel").value.trim()      || "#ff0000";
  const fCol = document.getElementById("inputCompanyColorFinal").value.trim()       || "#00ff00";
  const uCol = document.getElementById("inputCompanyColorUnavailable").value.trim() || "#cccccc";

  // companyColors 구조에 unavailable 필드 추가
  companyColors[name] = {
    normal: nCol,
    cancel: cCol,
    final: fCol,
    unavailable: uCol
  };

  db.ref("companyColors").set(companyColors)
    .then(() => {
      alert("업체 색상 저장 완료");
      // 저장 후 기본값 리셋
      document.getElementById("inputCompanyColorNormal").value      = "#999999";
      document.getElementById("inputCompanyColorCancel").value      = "#ff0000";
      document.getElementById("inputCompanyColorFinal").value       = "#00ff00";
      document.getElementById("inputCompanyColorUnavailable").value = "#cccccc";
      // 테이블 다시 그리기
      loadAllData().then(() => drawCompanyColorList());
    });
}

/* 업체 색상 삭제 */
function deleteCompanyColor(cName){
  if(!confirm(cName + " 색상정보를 삭제하시겠습니까?")) return;
  delete companyColors[cName];
  db.ref("companyColors").set(companyColors)
    .then(() => {
      alert("삭제 완료");
      loadAllData().then(() => drawCompanyColorList());
    });
}


    /****************************************
     18) 엑셀 업/다운로드 (스케줄 목록)
    *****************************************/
    function excelSerialToJSDate(serial) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const daysAfter = serial - 1; 
      return new Date(excelEpoch.getTime() + daysAfter * 86400000);
    }
    function formatExcelDateToYyyyMmDd(value) {
      if (typeof value === "number") {
        const jsDate = excelSerialToJSDate(value);
        return jsDate.toISOString().substring(0, 10); 
      } else if (typeof value === "string") {
        return value.substring(0, 10);
      } else {
        return "";
      }
    }
    function downloadExcel(){
      const statusToKorean = {
        "cancelled": "취소됨",
        "finalized": "최종 확정",
        "일정 변경 / 최종 확정": "일정 변경 / 최종 확정",
        "일정확정대기": "일정확정대기",
        "normal": "정상"
      };
      const exportData = schedules.map(sch => {
        let managerName = "";
        if (sch.managerId && users[sch.managerId]) {
          managerName = users[sch.managerId].id || "";
        }
        let engineerName = "";
        if (sch.userId && users[sch.userId]) {
          engineerName = users[sch.userId].id || "";
        }
        return {
          startDate: sch.startDate,
          endDate: sch.endDate,
          Ship_Name: sch.lineName || "",
          IMO_No: sch.imoNo || "",
          Hull_No: sch.hullNo || "",
          regionName: sch.regionName || "",
          details: sch.details || "",
          status: statusToKorean[sch.status] || sch.status || "정상",
          unavailable: sch.unavailable ? "네" : "아니요",
          cancelReason: sch.cancelReason || "",
          engineer: engineerName,
          hqManager: managerName
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Schedules");
      XLSX.writeFile(wb, "schedules_template.xlsx");
    }
    function uploadExcel(event){
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(ws, { raw: true });
        const koreanToStatus = {
          "취소됨": "cancelled",
          "최종 확정": "finalized",
          "일정 변경 / 최종 확정": "일정 변경 / 최종 확정",
          "일정확정대기": "일정확정대기",
          "정상": "normal"
        };
        const newArr = jsonData.map(row => {
          let managerUid = "";
          if (row.hqManager) {
            for (const uid in users) {
              if (users[uid].role === "본사" && users[uid].id === row.hqManager) {
                managerUid = uid;
                break;
              }
            }
          }
          let engineerUid = "";
          if (row.engineer) {
            for (const uid in users) {
              if (users[uid].role === "협력" && users[uid].id === row.engineer) {
                engineerUid = uid;
                break;
              }
            }
          }
          const start = parseExcelDate(row.startDate);
          const end   = parseExcelDate(row.endDate);
          const unavailableBool = (row.unavailable === "네");
          const statusInternal = koreanToStatus[row.status] || row.status || "normal";
          return {
            id: Date.now() + Math.floor(Math.random() * 100000),
            startDate: start,
            endDate: end,
            lineName: row.Ship_Name || "",
            imoNo: row.IMO_No || "",
            hullNo: row.Hull_No || "",
            regionName: row.regionName || "",
            details: row.details || "",
            status: statusInternal,
            userId: engineerUid,
            unavailable: unavailableBool,
            managerId: managerUid,
            cancelReason: row.cancelReason || ""
          };
        });
        schedules = newArr;
        db.ref("schedules").set(schedules)
          .then(() => {
            alert("엑셀 업로드 완료");
            drawScheduleList();
            refreshCalendar();
          })
          .catch(err => {
            console.error("업로드 에러:", err);
            alert("업로드 실패: " + err.message);
          });
      };
      reader.readAsArrayBuffer(file);
    }

    /****************************************
     19) 변경 히스토리 및 히스토리 엑셀 다운로드
    *****************************************/
    function drawHistoryList(){
      document.getElementById("historyLimitInput").value = historyLimit;
      const tbody = document.getElementById("adminHistoryBody");
      tbody.innerHTML = "";
      const sorted = [...histories].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      sorted.forEach(h => {
        const tr = document.createElement("tr");
        const tdTime = document.createElement("td");
        tdTime.style.width = "80px";
        tdTime.textContent = (h.timestamp || "").replace("T", " ").substring(0,19);
        const tdUser = document.createElement("td");
        tdUser.textContent = h.user || "";
        const tdOldStart = document.createElement("td");
        tdOldStart.textContent = h.oldStartDate || "";
        const tdOldEnd = document.createElement("td");
        tdOldEnd.textContent = h.oldEndDate || "";
        const tdNewStart = document.createElement("td");
        tdNewStart.textContent = h.newStartDate || "";
        const tdNewEnd = document.createElement("td");
        tdNewEnd.textContent = h.newEndDate || "";
        const tdAct = document.createElement("td");
        tdAct.textContent = h.action || "";
        tr.appendChild(tdTime);
        tr.appendChild(tdUser);
        tr.appendChild(tdOldStart);
        tr.appendChild(tdOldEnd);
        tr.appendChild(tdNewStart);
        tr.appendChild(tdNewEnd);
        tr.appendChild(tdAct);
        tbody.appendChild(tr);
      });
    }
    function setHistoryLimit(){
      const val = parseInt(document.getElementById("historyLimitInput").value, 10);
      if(isNaN(val) || val < 1){ alert("1 이상의 숫자를 입력하세요."); return; }
      historyLimit = val;
      db.ref("historyLimit").set(val).then(() => {
        alert("히스토리 최대 개수 설정 완료");
        enforceHistoryLimit();
      });
    }
    function downloadHistoryExcel(){
      const histData = histories.map(h => ({
          time: (h.timestamp || "").replace("T", " ").substring(0,19),
          user: h.user || "",
          oldStartDate: h.oldStartDate || "",
          oldEndDate: h.oldEndDate || "",
          newStartDate: h.newStartDate || "",
          newEndDate: h.newEndDate || "",
          action: h.action || ""
      }));
      const ws = XLSX.utils.json_to_sheet(histData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Histories");
      XLSX.writeFile(wb, "histories.xlsx");
    }

    /****************************************
     20) 달력 새로고침 및 날짜 포맷 함수
    *****************************************/
    function refreshCalendar(){
      if(document.getElementById("monthlySection").classList.contains("active")){
        drawMonthCalendar();
      }
      if(document.getElementById("weeklySection").classList.contains("active")){
        drawWeekCalendar();
      }
      if(document.getElementById("adminScheduleListPane").classList.contains("active")){
        drawScheduleList();
      }
    }
    function formatDate(y, m, d){
      const mm = String(m).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      return `${y}-${mm}-${dd}`;
    }
    function formatDateForLabel(dateObj){
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth()+1).padStart(2, "0");
      const d = String(dateObj.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    /****************************************
     21) EmailJS 발송
    *****************************************/
    function showRecipientSelectPopup(message, callback) {
      const existing = document.getElementById("emailRecipientPopupOverlay");
      if(existing) existing.remove();
      let overlay = document.createElement("div");
      overlay.id = "emailRecipientPopupOverlay";
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "10000";
      let popup = document.createElement("div");
      popup.style.backgroundColor = "#fff";
      popup.style.padding = "20px";
      popup.style.borderRadius = "8px";
      popup.style.width = "90%";
      popup.style.maxWidth = "600px";
      popup.style.boxSizing = "border-box";
      popup.style.maxHeight = "80%";
      popup.style.overflowY = "auto";
      let title = document.createElement("h3");
      title.textContent = "메일 발송 수신자 선택";
      popup.appendChild(title);
      let msgPara = document.createElement("p");
      msgPara.innerHTML = "<strong>메시지:</strong><br>" + message.replace(/\n/g, "<br>");
      popup.appendChild(msgPara);
      // 엔지니어 선택 영역
      let engineerContainer = document.createElement("div");
      engineerContainer.id = "emailEngineerContainer";
      engineerContainer.style.marginTop = "15px";
      let engineerLabel = document.createElement("p");
      engineerLabel.textContent = "메일 발송 엔지니어 선택:";
      engineerContainer.appendChild(engineerLabel);
      function addEngineerSelect() {
        let select = document.createElement("select");
        select.style.marginBottom = "5px";
        let emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "-- 선택 --";
        select.appendChild(emptyOpt);
        for (let uid in users) {
          if(users[uid].role === "협력") {
            if(currentUser && currentUser.role === "협력"){
              if(users[uid].company !== currentUser.company) continue;
            }
            let opt = document.createElement("option");
            opt.value = uid;
            opt.textContent = users[uid].email + " (" + users[uid].id + ")";
            select.appendChild(opt);
          }
        }
        engineerContainer.appendChild(select);
      }
      addEngineerSelect();
      let addEngineerBtn = document.createElement("button");
      addEngineerBtn.textContent = "+";
      addEngineerBtn.style.marginLeft = "10px";
      addEngineerBtn.onclick = addEngineerSelect;
      engineerContainer.appendChild(addEngineerBtn);
      popup.appendChild(engineerContainer);
      // 본사 담당자 선택 영역
      let managerContainer = document.createElement("div");
      managerContainer.id = "emailManagerContainer";
      managerContainer.style.marginTop = "15px";
      let managerLabel = document.createElement("p");
      managerLabel.textContent = "메일 발송 본사 담당자 선택:";
      managerContainer.appendChild(managerLabel);
      function addManagerSelect() {
        let select = document.createElement("select");
        select.style.marginBottom = "5px";
        let emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "-- 선택 --";
        select.appendChild(emptyOpt);
        for (let uid in users) {
          if(users[uid].role === "본사" || users[uid].role === "관리자"){
            let opt = document.createElement("option");
            opt.value = uid;
            opt.textContent = users[uid].email + " (" + users[uid].id + ")";
            select.appendChild(opt);
          }
        }
        managerContainer.appendChild(select);
      }
      addManagerSelect();
      let addManagerBtn = document.createElement("button");
      addManagerBtn.textContent = "+";
      addManagerBtn.style.marginLeft = "10px";
      addManagerBtn.onclick = addManagerSelect;
      managerContainer.appendChild(addManagerBtn);
      popup.appendChild(managerContainer);
      let btnContainer = document.createElement("div");
      btnContainer.style.textAlign = "right";
      btnContainer.style.marginTop = "20px";
      let sendBtn = document.createElement("button");
      sendBtn.textContent = "발송";
      sendBtn.style.marginRight = "10px";
      let cancelBtn = document.createElement("button");
      cancelBtn.textContent = "취소";
      btnContainer.appendChild(sendBtn);
      btnContainer.appendChild(cancelBtn);
      popup.appendChild(btnContainer);
      overlay.appendChild(popup);
      document.body.appendChild(overlay);
      sendBtn.onclick = function() {
        let selectedUIDs = [];
        let engSelects = engineerContainer.querySelectorAll("select");
        engSelects.forEach(function(select) {
          if(select.value.trim() !== ""){
            selectedUIDs.push(select.value);
          }
        });
        let mgrSelects = managerContainer.querySelectorAll("select");
        mgrSelects.forEach(function(select) {
          if(select.value.trim() !== ""){
            selectedUIDs.push(select.value);
          }
        });
        if(selectedUIDs.length === 0){
          alert("최소 한 명 이상의 수신자를 선택하세요.");
          return;
        }
        let selectedRecipients = [];
        selectedUIDs.forEach(function(uid) {
          if(users[uid] && users[uid].email) {
            selectedRecipients.push(users[uid].email);
          }
        });
        document.body.removeChild(overlay);
        callback(selectedRecipients);
      };
      cancelBtn.onclick = function() {
        document.body.removeChild(overlay);
        callback(false);
      };
    }
function sendEmailNotification(){
  var startDate = document.getElementById("modalStartDate").value;
  var endDate = document.getElementById("modalEndDate").value;
  var imoNo = document.getElementById("modalIMONo").value.trim();
  var shipName = document.getElementById("modalLine").value.trim();
  var hullNo = document.getElementById("modalHullNo").value.trim();
  var regionName = document.getElementById("modalRegion").value.trim();
  var workContent = document.getElementById("modalDetails").value.trim();
  var transferMsg = document.getElementById("modalMessage").value.trim();
  
  var engineerNames = "";
  var engineerSelect = document.getElementById("modalUserSelect");
  if(engineerSelect){
    engineerNames = Array.from(engineerSelect.selectedOptions)
                       .map(opt => opt.textContent.trim())
                       .join(", ");
  }
  
  var extraEngineerNames = "";
  var extraContainer = document.getElementById("additionalEngineerRows");
  if(extraContainer){
    extraEngineerNames = Array.from(extraContainer.querySelectorAll("select"))
                             .map(sel => {
                                return Array.from(sel.selectedOptions)
                                           .map(opt => opt.textContent.trim())
                                           .join(", ");
                             })
                             .join(", ");
  }
  
  var allEngineerNames = engineerNames;
  if(extraEngineerNames){
    allEngineerNames = allEngineerNames ? (allEngineerNames + ", " + extraEngineerNames) : extraEngineerNames;
  }
  
  var managerNames = "";
  var managerSelect = document.getElementById("modalManagerSelect");
  if(managerSelect){
    managerNames = Array.from(managerSelect.selectedOptions)
                     .map(opt => opt.textContent.trim())
                     .join(", ");
  }
  
  var msg = "";
  msg += "엔지니어: " + (allEngineerNames || "미지정") + "\n";
  msg += "본사 담당자: " + (managerNames || "미지정") + "\n";
  msg += "시작일: " + startDate + "\n";
  msg += "종료일: " + endDate + "\n";
  msg += "IMO No.: " + imoNo + "\n";
  msg += "Ship Name: " + shipName + "\n";
  msg += "Hull No.: " + hullNo + "\n";
  msg += "지역: " + regionName + "\n";
  msg += "작업내용: " + workContent + "\n";
  msg += "전달사항: " + transferMsg;
  
  showRecipientSelectPopup(msg, function(selectedRecipients){
    if(selectedRecipients === false){
      alert("이메일 발송이 취소되었습니다.");
      return;
    }
    
    // 만약 selectedRecipients가 문자열이라면 콤마로 분할하여 배열로 변환
    if(typeof selectedRecipients === "string"){
      selectedRecipients = selectedRecipients.split(",").map(email => email.trim());
    }
    
    // 중복 제거
    selectedRecipients = selectedRecipients.filter((email, index, arr) => arr.indexOf(email) === index);
    
    // 발신자 이메일: currentUser.email이 있으면 사용, 없으면 기본값 사용
    var fromEmail = (typeof currentUser !== "undefined" && currentUser.email) ? currentUser.email : "noreply@example.com";
    
    // 각 이메일 주소로 개별 전송 (동시에 전송)
    Promise.all(selectedRecipients.map(function(email){
      return emailjs.send("service_cvipu3z", "template_aneojps", { 
         to_email: email,
         from_email: fromEmail,
         message: msg
      });
    }))
    .then(function(responses){
      console.log("이메일 전송 성공:", responses);
      alert("모든 이메일이 전송되었습니다.");
    })
    .catch(function(error){
      console.error("이메일 전송 실패:", error);
      alert("이메일 전송에 실패했습니다.");
    });
  });
}

    /****************************************
     22) 타임 테이블 모달 관련 기능
    *****************************************/
    function openTimeTableModal(){
      db.ref("timeTable").once("value").then(snap => {
        if(snap.exists()){
          timeTableData = [];
          snap.forEach(child => { timeTableData.push(child.val()); });
        } else { timeTableData = []; }
        renderTimeTable();
        document.getElementById("timeTableModalBg").style.display = "block";
      });
    }
    function closeTimeTableModal(){
      document.getElementById("timeTableModalBg").style.display = "none";
    }
    function renderTimeTable(){
      const tbody = document.getElementById("timeTableBody");
      tbody.innerHTML = "";
      timeTableData.forEach((row, index) => {
        const tr = document.createElement("tr");
        const tdTime = document.createElement("td");
        const inputTime = document.createElement("input");
        inputTime.type = "text";
        inputTime.value = row.time || "";
        tdTime.appendChild(inputTime);
        const tdWork = document.createElement("td");
        const inputWork = document.createElement("input");
        inputWork.type = "text";
        inputWork.value = row.work || "";
        tdWork.appendChild(inputWork);
        const tdDelete = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.textContent = "삭제";
        delBtn.onclick = function(){ timeTableData.splice(index, 1); renderTimeTable(); };
        tdDelete.appendChild(delBtn);
        tr.appendChild(tdTime);
        tr.appendChild(tdWork);
        tr.appendChild(tdDelete);
        tbody.appendChild(tr);
      });
    }
    function addTimeTableRow(){
      timeTableData.push({ time:"", work:"" });
      renderTimeTable();
    }
    function saveTimeTable(){
      const tbody = document.getElementById("timeTableBody");
      const newData = [];
      tbody.querySelectorAll("tr").forEach(row => {
        const inputs = row.querySelectorAll("input");
        newData.push({ time: inputs[0].value, work: inputs[1].value });
      });
      timeTableData = newData;
      db.ref("timeTable").set(timeTableData).then(() => {
        alert("타임 테이블 저장 완료");
        closeTimeTableModal();
      });
    }
    function downloadTimeTableExcel(){
      const ws = XLSX.utils.json_to_sheet(timeTableData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TimeTable");
      XLSX.writeFile(wb, "timeTable.xlsx");
    }
    function uploadTimeTableExcel(event){
      const file = event.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:"array"});
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        timeTableData = jsonData;
        renderTimeTable();
      };
      reader.readAsArrayBuffer(file);
    }

    /****************************************
     유저 등록/수정 관련 추가 함수 (협력 구분)
    *****************************************/
    function toggleRegisterSubCategory() {
      var role = document.getElementById("adminRegisterRole").value;
      var row = document.getElementById("adminRegisterSubCategoryRow");
      if(role === "협력") {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    }

    /****************************************
     스케줄 등록/수정 모달 관련: '기타 협력사 포함' 체크박스 제어
    *****************************************/
    // openModal 함수 내에서 이미 처리 (본사/관리자일 때 includeOtherPartnersRow 표시)

    /****************************************
     15) 가용 엔지니어 업데이트 함수 수정 (주요/기타 협력사 필터)
    *****************************************/
function updateAvailableEngineers(sDate, eDate){
  const listDiv = document.getElementById("availableEngineersList");
  if(!sDate || !eDate){
    listDiv.textContent = "시작/종료일을 먼저 입력하세요.";
    return;
  }
  let includeOther = false;
  const checkbox = document.getElementById("includeOtherPartnersCheckbox");
  if(checkbox) { includeOther = checkbox.checked; }
  const available = [];
  for(const uid in users){
    if(users[uid].role === "협력"){
      // 협력 사용자는 본인 회사의 협력자만 보임
      if(currentUser.role === "협력" && users[uid].company !== currentUser.company) continue;
      let subCategory = users[uid].subCategory || "기타";
      if(subCategory !== "주요" && !includeOther) continue;
      const conflict = schedules.some(sch => {
         if(sch.userId !== uid) return false;
         if(sch.status === "cancelled") return false;
         return (sch.startDate <= eDate && sch.endDate >= sDate);
      });
      if(!conflict) available.push(uid);
    }
  }
  if(available.length < 1){
    listDiv.textContent = "가용 엔지니어 없음";
  } else {
    listDiv.textContent = available.map(uid => users[uid].id + " (" + (users[uid].company || "업체 미지정") + ")").join(", ");
  }
}


    /****************************************
     수신자 선택 팝업 (이메일 발송용)
    *****************************************/
    function showRecipientSelectPopup(message, callback) {
      const existing = document.getElementById("emailRecipientPopupOverlay");
      if(existing) existing.remove();
      let overlay = document.createElement("div");
      overlay.id = "emailRecipientPopupOverlay";
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "10000";
      let popup = document.createElement("div");
      popup.style.backgroundColor = "#fff";
      popup.style.padding = "20px";
      popup.style.borderRadius = "8px";
      popup.style.width = "90%";
      popup.style.maxWidth = "600px";
      popup.style.boxSizing = "border-box";
      popup.style.maxHeight = "80%";
      popup.style.overflowY = "auto";
      let title = document.createElement("h3");
      title.textContent = "메일 발송 수신자 선택";
      popup.appendChild(title);
      let msgPara = document.createElement("p");
      msgPara.innerHTML = "<strong>메시지:</strong><br>" + message.replace(/\n/g, "<br>");
      popup.appendChild(msgPara);
      // 엔지니어 선택 영역
      let engineerContainer = document.createElement("div");
      engineerContainer.id = "emailEngineerContainer";
      engineerContainer.style.marginTop = "15px";
      let engineerLabel = document.createElement("p");
      engineerLabel.textContent = "메일 발송 엔지니어 선택:";
      engineerContainer.appendChild(engineerLabel);
      function addEngineerSelect() {
        let select = document.createElement("select");
        select.style.marginBottom = "5px";
        let emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "-- 선택 --";
        select.appendChild(emptyOpt);
        for (let uid in users) {
          if(users[uid].role === "협력") {
            if(currentUser && currentUser.role === "협력"){
              if(users[uid].company !== currentUser.company) continue;
            }
            let opt = document.createElement("option");
            opt.value = uid;
            opt.textContent = users[uid].email + " (" + users[uid].id + ")";
            select.appendChild(opt);
          }
        }
        engineerContainer.appendChild(select);
      }
      addEngineerSelect();
      let addEngineerBtn = document.createElement("button");
      addEngineerBtn.textContent = "+";
      addEngineerBtn.style.marginLeft = "10px";
      addEngineerBtn.onclick = addEngineerSelect;
      engineerContainer.appendChild(addEngineerBtn);
      popup.appendChild(engineerContainer);
      // 본사 담당자 선택 영역
      let managerContainer = document.createElement("div");
      managerContainer.id = "emailManagerContainer";
      managerContainer.style.marginTop = "15px";
      let managerLabel = document.createElement("p");
      managerLabel.textContent = "메일 발송 본사 담당자 선택:";
      managerContainer.appendChild(managerLabel);
      function addManagerSelect() {
        let select = document.createElement("select");
        select.style.marginBottom = "5px";
        let emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "-- 선택 --";
        select.appendChild(emptyOpt);
        for (let uid in users) {
          if(users[uid].role === "본사" || users[uid].role === "관리자"){
            let opt = document.createElement("option");
            opt.value = uid;
            opt.textContent = users[uid].email + " (" + users[uid].id + ")";
            select.appendChild(opt);
          }
        }
        managerContainer.appendChild(select);
      }
      addManagerSelect();
      let addManagerBtn = document.createElement("button");
      addManagerBtn.textContent = "+";
      addManagerBtn.style.marginLeft = "10px";
      addManagerBtn.onclick = addManagerSelect;
      managerContainer.appendChild(addManagerBtn);
      popup.appendChild(managerContainer);
      let btnContainer = document.createElement("div");
      btnContainer.style.textAlign = "right";
      btnContainer.style.marginTop = "20px";
      let sendBtn = document.createElement("button");
      sendBtn.textContent = "발송";
      sendBtn.style.marginRight = "10px";
      let cancelBtn = document.createElement("button");
      cancelBtn.textContent = "취소";
      btnContainer.appendChild(sendBtn);
      btnContainer.appendChild(cancelBtn);
      popup.appendChild(btnContainer);
      overlay.appendChild(popup);
      document.body.appendChild(overlay);
      sendBtn.onclick = function() {
        let selectedUIDs = [];
        let engSelects = engineerContainer.querySelectorAll("select");
        engSelects.forEach(function(select) {
          if(select.value.trim() !== ""){
            selectedUIDs.push(select.value);
          }
        });
        let mgrSelects = managerContainer.querySelectorAll("select");
        mgrSelects.forEach(function(select) {
          if(select.value.trim() !== ""){
            selectedUIDs.push(select.value);
          }
        });
        if(selectedUIDs.length === 0){
          alert("최소 한 명 이상의 수신자를 선택하세요.");
          return;
        }
        let selectedRecipients = [];
        selectedUIDs.forEach(function(uid) {
          if(users[uid] && users[uid].email) {
            selectedRecipients.push(users[uid].email);
          }
        });
        document.body.removeChild(overlay);
        callback(selectedRecipients);
      };
      cancelBtn.onclick = function() {
        document.body.removeChild(overlay);
        callback(false);
      };
    }

    /****************************************
     22) 아래는 본사 전용 현황 페이지용 함수들
         - 유저 목록, 스케줄 목록, 변경 히스토리 표시 (읽기 전용)
    *****************************************/
function drawStatusUserList(){
  populateStatusUserFilter();
  const filterSelect = document.getElementById("statusUserCompanyFilter");
  const selectedCompany = filterSelect.value;
  const tbody = document.getElementById("statusUserListBody");
  tbody.innerHTML = "";
  let userArray = [];
  for(const uid in users){
    userArray.push({ uid: uid, user: users[uid] });
  }
  userArray.sort((a,b) => {
    let compA = a.user.company ? a.user.company.toLowerCase() : "";
    let compB = b.user.company ? b.user.company.toLowerCase() : "";
    if(compA < compB) return -1;
    if(compA > compB) return 1;
    return 0;
  });
  userArray.forEach(item => {
    if(selectedCompany && item.user.company !== selectedCompany) return;
    let tr = document.createElement("tr");
    let tdName = document.createElement("td");
    tdName.textContent = item.user.id || "";
    let tdEmail = document.createElement("td");
    tdEmail.textContent = item.user.email || "";
    let tdRole = document.createElement("td");
    tdRole.textContent = item.user.role;
    let tdSub = document.createElement("td");
    tdSub.textContent = (item.user.role === "협력" ? (item.user.subCategory || "기타") : "");
    let tdComp = document.createElement("td");
    tdComp.textContent = item.user.company || "";
    tr.appendChild(tdName);
    tr.appendChild(tdEmail);
    tr.appendChild(tdRole);
    tr.appendChild(tdSub);
    tr.appendChild(tdComp);
    tbody.appendChild(tr);
  });
}

// 스케줄 목록 렌더링 (기간 설정 적용, 읽기 전용)
function drawStatusScheduleList(){
  const qStart = document.getElementById("statusQueryStart").value;
  const qEnd = document.getElementById("statusQueryEnd").value;
  const tbody = document.getElementById("statusScheduleListBody");
  tbody.innerHTML = "";
  const filtered = schedules.filter(sch => sch.startDate <= qEnd && sch.endDate >= qStart);
  filtered.forEach(sch => {
      const tr = document.createElement("tr");
      const tdCompany = document.createElement("td");
      const userObj = users[sch.userId] || {};
      tdCompany.textContent = userObj.company || "(업체 미지정)";
      tr.appendChild(tdCompany);
      const tdEngineer = document.createElement("td");
      tdEngineer.textContent = userObj.id || "";
      tr.appendChild(tdEngineer);
      const tdPeriod = document.createElement("td");
      tdPeriod.textContent = `${sch.startDate} ~ ${sch.endDate}`;
      tr.appendChild(tdPeriod);
      const tdShipName = document.createElement("td");
      tdShipName.textContent = sch.lineName || "";
      tr.appendChild(tdShipName);
      const tdIMONo = document.createElement("td");
      tdIMONo.textContent = sch.imoNo || "";
      tr.appendChild(tdIMONo);
      const tdHullNo = document.createElement("td");
      tdHullNo.textContent = sch.hullNo || "";
      tr.appendChild(tdHullNo);
      const tdRegion = document.createElement("td");
      tdRegion.textContent = sch.regionName || "";
      tr.appendChild(tdRegion);
      const tdManager = document.createElement("td");
      if(sch.managerId && users[sch.managerId]){
         tdManager.textContent = users[sch.managerId].id || "";
      } else { tdManager.textContent = ""; }
      tr.appendChild(tdManager);
      const tdDetails = document.createElement("td");
      tdDetails.textContent = sch.details || "";
      tr.appendChild(tdDetails);
      const tdUnavailable = document.createElement("td");
      tdUnavailable.style.textAlign = "left";
      tdUnavailable.textContent = sch.unavailable ? "서비스 불가" : "";
      tr.appendChild(tdUnavailable);
      tbody.appendChild(tr);
  });
}
function setDefaultStatusScheduleDates(){
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  document.getElementById("statusQueryStart").value = todayStr;
  
  const oneMonthLater = new Date(today);
  oneMonthLater.setMonth(oneMonthLater.getMonth()+1);
  const yyyy2 = oneMonthLater.getFullYear();
  const mm2 = String(oneMonthLater.getMonth()+1).padStart(2, "0");
  const dd2 = String(oneMonthLater.getDate()).padStart(2, "0");
  const oneMonthLaterStr = `${yyyy2}-${mm2}-${dd2}`;
  document.getElementById("statusQueryEnd").value = oneMonthLaterStr;
}

// 변경 히스토리 렌더링 (기존 drawStatusHistory() 그대로 사용)
function drawStatusHistory(){
  const tbody = document.getElementById("statusHistoryBody");
  tbody.innerHTML = "";
  const sorted = [...histories].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  sorted.forEach(h => {
     const tr = document.createElement("tr");
     const tdTime = document.createElement("td");
     tdTime.style.width = "80px";
     tdTime.textContent = (h.timestamp || "").replace("T", " ").substring(0,19);
     const tdUser = document.createElement("td");
     tdUser.textContent = h.user || "";
     const tdOldStart = document.createElement("td");
     tdOldStart.textContent = h.oldStartDate || "";
     const tdOldEnd = document.createElement("td");
     tdOldEnd.textContent = h.oldEndDate || "";
     const tdNewStart = document.createElement("td");
     tdNewStart.textContent = h.newStartDate || "";
     const tdNewEnd = document.createElement("td");
     tdNewEnd.textContent = h.newEndDate || "";
     const tdAct = document.createElement("td");
     tdAct.textContent = h.action || "";
     tr.appendChild(tdTime);
     tr.appendChild(tdUser);
     tr.appendChild(tdOldStart);
     tr.appendChild(tdOldEnd);
     tr.appendChild(tdNewStart);
     tr.appendChild(tdNewEnd);
     tr.appendChild(tdAct);
     tbody.appendChild(tr);
  });
}
    function drawStatusPage(){
      drawStatusUserList();
      drawStatusScheduleList();
      drawStatusHistory();
    }

    /****************************************
     1) 엑셀 시리얼 날짜 변환 함수 (수정됨)
    *****************************************/
    function parseExcelDate(cellValue) {
      if (!cellValue) return "";
      if (typeof cellValue === "number") {
        var d = new Date(1899, 11, 31);
        d.setDate(d.getDate() + cellValue);
        return d.toISOString().substring(0, 10);
      }
      if (typeof cellValue === "string") {
        var tryDate = new Date(cellValue);
        if (!isNaN(tryDate.getTime())) {
          return tryDate.toISOString().substring(0, 10);
        } else {
          return cellValue.substring(0, 10);
        }
      }
      return "";
    }
// 현황 메뉴 전환 (기존 showStatusPane()와 동일)
function showStatusPane(type){
   // 모든 판 숨김
   document.getElementById("statusUserPane").style.display = "none";
   document.getElementById("statusSchedulePane").style.display = "none";
   document.getElementById("statusHistoryPane").style.display = "none";
   // 버튼 active 제거
   document.getElementById("btnStatusUser").classList.remove("active");
   document.getElementById("btnStatusSchedule").classList.remove("active");
   document.getElementById("btnStatusHistory").classList.remove("active");
   if(type === "user"){
      document.getElementById("statusUserPane").style.display = "block";
      document.getElementById("btnStatusUser").classList.add("active");
      drawStatusUserList();
   } else if(type === "schedule"){
      document.getElementById("statusSchedulePane").style.display = "block";
      document.getElementById("btnStatusSchedule").classList.add("active");
      setDefaultStatusScheduleDates();
      drawStatusScheduleList();
   } else if(type === "history"){
      document.getElementById("statusHistoryPane").style.display = "block";
      document.getElementById("btnStatusHistory").classList.add("active");
      drawStatusHistory();
   }
}



function drawStatusScheduleList(){
  const qStart = document.getElementById("statusQueryStart").value;
  const qEnd = document.getElementById("statusQueryEnd").value;
  const tbody = document.getElementById("statusScheduleListBody");
  tbody.innerHTML = "";
  const filtered = schedules.filter(sch => sch.startDate <= qEnd && sch.endDate >= qStart);
  filtered.forEach(sch => {
      const tr = document.createElement("tr");
      const tdCompany = document.createElement("td");
      const userObj = users[sch.userId] || {};
      tdCompany.textContent = userObj.company || "(업체 미지정)";
      tr.appendChild(tdCompany);
      const tdEngineer = document.createElement("td");
      tdEngineer.textContent = userObj.id || "";
      tr.appendChild(tdEngineer);
      const tdPeriod = document.createElement("td");
      tdPeriod.textContent = `${sch.startDate} ~ ${sch.endDate}`;
      tr.appendChild(tdPeriod);
      const tdShipName = document.createElement("td");
      tdShipName.textContent = sch.lineName || "";
      tr.appendChild(tdShipName);
      const tdIMONo = document.createElement("td");
      tdIMONo.textContent = sch.imoNo || "";
      tr.appendChild(tdIMONo);
      const tdHullNo = document.createElement("td");
      tdHullNo.textContent = sch.hullNo || "";
      tr.appendChild(tdHullNo);
      const tdRegion = document.createElement("td");
      tdRegion.textContent = sch.regionName || "";
      tr.appendChild(tdRegion);
      const tdManager = document.createElement("td");
      if(sch.managerId && users[sch.managerId]){
         tdManager.textContent = users[sch.managerId].id || "";
      } else { tdManager.textContent = ""; }
      tr.appendChild(tdManager);
      const tdDetails = document.createElement("td");
      tdDetails.textContent = sch.details || "";
      tr.appendChild(tdDetails);
      const tdUnavailable = document.createElement("td");
      tdUnavailable.style.textAlign = "left";
      tdUnavailable.textContent = sch.unavailable ? "서비스 불가" : "";
      tr.appendChild(tdUnavailable);
      tbody.appendChild(tr);
  });
}


function drawStatusHistory(){
  const tbody = document.getElementById("statusHistoryBody");
  tbody.innerHTML = "";
  const sorted = [...histories].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  sorted.forEach(h => {
     const tr = document.createElement("tr");
     const tdTime = document.createElement("td");
     tdTime.style.width = "80px";
     tdTime.textContent = (h.timestamp || "").replace("T", " ").substring(0,19);
     const tdUser = document.createElement("td");
     tdUser.textContent = h.user || "";
     const tdOldStart = document.createElement("td");
     tdOldStart.textContent = h.oldStartDate || "";
     const tdOldEnd = document.createElement("td");
     tdOldEnd.textContent = h.oldEndDate || "";
     const tdNewStart = document.createElement("td");
     tdNewStart.textContent = h.newStartDate || "";
     const tdNewEnd = document.createElement("td");
     tdNewEnd.textContent = h.newEndDate || "";
     const tdAct = document.createElement("td");
     tdAct.textContent = h.action || "";
     tr.appendChild(tdTime);
     tr.appendChild(tdUser);
     tr.appendChild(tdOldStart);
     tr.appendChild(tdOldEnd);
     tr.appendChild(tdNewStart);
     tr.appendChild(tdNewEnd);
     tr.appendChild(tdAct);
     tbody.appendChild(tr);
  });
}


