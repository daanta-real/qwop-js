// bundle.js에 있는 트랜스컴파일된 Java QWOP 구현을 로드하고 GUI를 설정합니다.

var frameRate  = 1/25; // 초당 프레임 수
var frameDelay = frameRate * 1000; // 프레임 간 지연 시간 (밀리초)

var canvas; // 캔버스 요소
var ctx; // 캔버스 2D 렌더링 컨텍스트
var width; // 캔버스 너비
var height; // 캔버스 높이
var qwopGame = new game.GameSingleThread(); // QWOP 게임 인스턴스 생성
var qwopInitialState = game.GameSingleThread.getInitialState(); // 게임의 초기 상태 가져오기
var yGravitySlider = document.getElementById('yGravitySlider'); // Y축 중력 조절 슬라이더
var maxTorqueMultSlider = document.getElementById('maxTorqueMultSlider'); // 최대 토크 배율 조절 슬라이더
var torsInertiaMultSlider = document.getElementById('torsInertiaMultSlider'); // 몸통 관성 배율 조절 슬라이더
var pointFeetCheckbox = document.getElementById('usePointFeet'); // 발 끝 모으기 사용 여부 체크박스

var torsoAngleStabilization = false; // 몸통 각도 안정화 사용 여부
var torsoAngleStabilizerCheckbox = document.getElementById('useTorsoAngleStabilizer'); // 몸통 각도 안정화 사용 여부 체크박스
var torsoAngleStabilizerGainSlider = document.getElementById('torsoStabilizerGainSlider'); // 몸통 각도 안정화 게인 조절 슬라이더
var torsoAngleStabilizerK = 0; // 몸통 각도 안정화 비례 상수
var torsoAngleStabilizerC = 0; // 몸통 각도 안정화 미분 상수

var torsoVerticalStabilization = false; // 몸통 수직 안정화 사용 여부
var torsoVerticalStabilizerCheckbox = document.getElementById('useTorsoVerticalStabilizer'); // 몸통 수직 안정화 사용 여부 체크박스
var torsoVerticalStabilizerGainSlider = document.getElementById('torsoVerticalStabilizerSlider'); // 몸통 수직 안정화 게인 조절 슬라이더
var torsoVerticalStabilizerK = 0; // 몸통 수직 안정화 비례 상수
var torsoVerticalStabilizerC = 0; // 몸통 수직 안정화 미분 상수

var actionQueue = new actions.ActionQueue(); // 액션 큐 생성
var sequenceTextbox = document.getElementById('sequenceTextbox'); // 액션 시퀀스 입력 텍스트 상자
var sequenceGoButton = document.getElementById('sequenceGoButton'); // 액션 시퀀스 실행 버튼

var scaling = 17; // 렌더링 스케일
var xOffset = 100; // X축 오프셋
var yOffset = 300; // Y축 오프셋
var q = false; // Q 키 상태
var w = false; // W 키 상태
var o = false; // O 키 상태
var p = false; // P 키 상태

// 이미지
const imagePaths = [
    "/hgop_foot_r.png",
    "/hgop_foot_l.png",
    "/hgop_leg_l_lower.png",//"/hgop_leg_r_lower.png",
    "/hgop_leg_l_lower.png",
    "/hgop_leg_r_upper.png",
    "/hgop_leg_l_upper.png",
    "/hgop_body.png",
    "/hgop_arm_r_upper.png",
    "/hgop_arm_l_upper.png",
    "/hgop_arm_r_lower.png",
    "/hgop_arm_l_lower.png"
];

// 이미지 스케일들
const imaegScalesX = [
    1, // hgop_foot_r.png
    1, // hgop_foot_l.png
    3, // hgop_leg_r_lower.png
    3, // hgop_leg_l_lower.png
    3, // hgop_leg_r_upper.png
    3, // hgop_leg_l_upper.png
    2.5, // hgop_body.png
    6, // hgop_arm_r_upper.png
    8, // hgop_arm_l_upper.png
    8, // hgop_arm_r_lower.png
    12, // hgop_arm_l_lower.png
];

// 이미지 스케일들
const imaegScalesY = [
    0.8, // hgop_foot_r.png
    0.8, // hgop_foot_l.png
    1.5, // hgop_leg_r_lower.png
    1.1, // hgop_leg_l_lower.png
    1.2, // hgop_leg_r_upper.png
    1.2, // hgop_leg_l_upper.png
    1.2, // hgop_body.png
    1.5, // hgop_arm_r_upper.png
    1.2, // hgop_arm_l_upper.png
    1, // hgop_arm_r_lower.png
    1.5, // hgop_arm_l_lower.png
];

// 이미지 오프셋 X
const imageOffsetsX = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -45,
]

// 이미지 오프셋 Y
const imageOffsetsY = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
]

const images = [];
for (let i = 0; i < imagePaths.length; i++) {
    const img = new Image();
    img.src = imagePaths[i];
    images.push(img);
}


// 게임 루프 함수
var loop = function() {

    // 시간이 지남에 따라 물리 시뮬레이션을 진행합니다.
    if (!actionQueue.isEmpty()) {
        var command = actionQueue.pollCommand(); // 액션 큐에서 다음 명령을 가져옵니다.
        q = command[0]; // Q 키 상태 업데이트
        w = command[1]; // W 키 상태 업데이트
        o = command[2]; // O 키 상태 업데이트
        p = command[3]; // P 키 상태 업데이트
    }

    // 신의 손을 사용하여 몸통 각도에 대한 PD 제어기를 적용합니다.
    if (torsoAngleStabilization) {
        var currState = qwopGame.getCurrentState(); // 현재 게임 상태 가져오기
        qwopGame.applyBodyTorque(torsoAngleStabilizerK*(qwopInitialState.body.getTh() - currState.body.getTh() - 0.2)
            - torsoAngleStabilizerC * currState.body.getDth()); // 몸통에 토크 적용
    }

    // 신의 손을 사용하여 몸통 수직 위치에 대한 PD 제어기를 적용합니다.
    if (torsoVerticalStabilization) {
        var currState = qwopGame.getCurrentState(); // 현재 게임 상태 가져오기
        qwopGame.applyBodyImpulse(0, torsoVerticalStabilizerK * (qwopInitialState.body.getY() - currState.body.getY())
            - torsoVerticalStabilizerC * currState.body.getDy()); // 몸통에 충격량 적용
    }

    qwopGame.stepGame(q, w, o, p); // 게임 시뮬레이션 한 단계 진행

    // 게임에서 몸체 모양의 정점들을 가져옵니다.
    var bodyVerts = qwopGame.getDebugVertices();

    runnerX = bodyVerts.torsoX; // 달리기 선수의 X 좌표

    /// 그리기 설정
    ctx.clearRect(0, 0, width, height); // 캔버스 내용 지우기
    ctx.save(); // 현재 캔버스 상태 저장

    // 몸통, 양팔 윗부분과 아랫부분, 양다리 윗부분과 아랫부분, 왼발, 오른발에 대한 사각형을 그립니다.
    renderAllParts(bodyVerts);

    // 머리를 그립니다.
    renderHead(bodyVerts);

    // 땅을 그립니다.
    groundH = bodyVerts.groundHeight; // 땅의 높이
    ctx.beginPath(); // 새로운 경로 시작
    ctx.moveTo(0, scaling * groundH + yOffset); // 시작점 설정
    ctx.lineTo(width, scaling * groundH + yOffset); // 끝점 설정
    ctx.stroke(); // 선 그리기
    ctx.closePath(); // 경로 닫기

    // 움직임을 보여주기 위해 땅에 점선을 그립니다.
    var dashSpacing = 25; // 점선 간 간격 (픽셀)
    ctx.beginPath(); // 새로운 경로 시작
    for (dashPos = -(scaling * runnerX) % dashSpacing; dashPos < width; dashPos += dashSpacing) {
        ctx.moveTo(dashPos, scaling * groundH + yOffset); // 시작점 설정
        ctx.lineTo(dashPos - 8, scaling * groundH + yOffset + 12); // 끝점 설정
    }
    ctx.stroke(); // 선 그리기
    ctx.closePath(); // 경로 닫기

    ctx.restore(); // 저장된 캔버스 상태 복원
};

// 캔버스 크기를 설정하는 함수
var setCanvasDimensions = function(){
    canvas.width  = canvas.offsetWidth; // 캔버스 너비를 HTML 요소의 너비에 맞춥니다.
    canvas.height = 300; // 캔버스 높이를 300으로 설정합니다.
    width = canvas.width; // 캔버스 너비 업데이트
    height = canvas.height; // 캔버스 높이 업데이트
    xOffset = width/2; // X축 오프셋을 캔버스 너비의 절반으로 설정
    yOffset = Math.min(300, height/2.2); // Y축 오프셋을 300 또는 캔버스 높이의 2.2분의 1 중 작은 값으로 설정
};

// 달리기 선수를 초기 상태로 재설정하는 함수
var resetRunner = function() {
    actionQueue = new actions.ActionQueue(); // 액션 큐 초기화
    q = false; // Q 키 상태 초기화
    w = false; // W 키 상태 초기화
    o = false; // O 키 상태 초기화
    p = false; // P 키 상태 초기화
    qwopGame.makeNewWorld(); // 새로운 게임 월드 생성
    qwopGame.setGravity(0., parseFloat(yGravitySlider.value)); // Y축 중력 설정
    qwopGame.setMaxTorqueMultiplier(parseFloat(maxTorqueMultSlider.value) / 10); // 최대 토크 배율 설정
    qwopGame.setBodyInertiaMultiplier(parseFloat(torsInertiaMultSlider.value) / 10)}; // 몸통 관성 배율 설정

// 초기 설정 함수
var setup = function() {

    window.onresize = setCanvasDimensions; // 창 크기가 변경될 때 캔버스 크기 재설정

    canvas = document.getElementById('canvas'); // 캔버스 요소 가져오기
    ctx = canvas.getContext('2d'); // 2D 렌더링 컨텍스트 가져오기

    canvas.style.width ='100%'; // 캔버스 너비를 100%로 설정
    canvas.style.height='100%'; // 캔버스 높이를 100%로 설정
    setCanvasDimensions(); // 캔버스 크기 초기 설정

    // 핀치 줌 비활성화 시도. IOS에서는 작동하지 않는 것 같습니다.
    document.addEventListener('touchmove', function (event) {
        if (event.scale !== 1) { event.preventDefault(); }
    }, false);

    var qbutton = document.getElementById('qbutton'); // Q 버튼 요소 가져오기
    var wbutton = document.getElementById('wbutton'); // W 버튼 요소 가져오기
    var obutton = document.getElementById('obutton'); // O 버튼 요소 가져오기
    var pbutton = document.getElementById('pbutton'); // P 버튼 요소 가져오기
    var resetbutton = document.getElementById('resetbutton'); // 리셋 버튼 요소 가져오기

    var yGravityVal = document.getElementById('yGravityVal'); // Y축 중력 값 표시 요소 가져오기
    var maxTorqueMultVal = document.getElementById('maxTorqueMultVal'); // 최대 토크 배율 값 표시 요소 가져오기
    var torsoInertiaMultVal = document.getElementById('torsoInertiaMultVal'); // 몸통 관성 배율 값 표시 요소 가져오기
    var torsoStabilizerGainVal = document.getElementById('torsoStabilizerGainValue'); // 몸통 안정화 게인 값 표시 요소 가져오기
    var torsoVertStabilizerGainVal = document.getElementById('torsoVertStabilizerGainVal'); // 몸통 수직 안정화 게인 값 표시 요소 가져오기

    yGravityVal.innerHTML = yGravitySlider.value; // 초기 Y축 중력 값 표시

    // Y축 중력 슬라이더 입력 처리
    yGravitySlider.oninput = function() {
        yGravityVal.innerHTML = this.value; // 현재 슬라이더 값으로 표시 업데이트
        qwopGame.setGravity(0., parseFloat(this.value)); // 게임 중력 업데이트
    };

    // 최대 토크 배율 슬라이더 입력 처리
    maxTorqueMultSlider.oninput = function() {
        maxTorqueMultVal.innerHTML = this.value / 10; //qwopGame.setMaxTorqueMultiplier(parseFloat(this.value) / 10); // 게임 최대 토크 배율 업데이트
    };

    // 몸통 관성 배율 슬라이더 입력 처리
    torsInertiaMultSlider.oninput = function() {
        torsoInertiaMultVal.innerHTML = this.value / 10; // 현재 슬라이더 값으로 표시 업데이트
        qwopGame.setBodyInertiaMultiplier(parseFloat(this.value) / 10); // 게임 몸통 관성 배율 업데이트
    };

    // 발 끝 모으기 체크박스 입력 처리 (게임 재설정)
    pointFeetCheckbox.oninput = function() {
        qwopGame.setPointFeet(pointFeetCheckbox.checked); // 발 끝 모으기 설정 업데이트
        resetRunner(); // 달리기 선수 재설정
    };

    // 몸통 각도 안정화 체크박스 입력 처리
    torsoAngleStabilizerCheckbox.oninput = function() {
        torsoAngleStabilization = torsoAngleStabilizerCheckbox.checked; // 몸통 각도 안정화 사용 여부 업데이트
        torsoAngleStabilizerGainSlider.hidden = !torsoAngleStabilization; // 게인 슬라이더 숨김/표시
        torsoStabilizerGainVal.hidden = !torsoAngleStabilization; // 게인 값 표시 숨김/표시
        torsoStabilizerGainVal.innerHTML = "Strength: " + torsoAngleStabilizerGainSlider.value; // 게인 값 표시 업데이트
        torsoAngleStabilizerK = torsoAngleStabilizerGainSlider.value * 100; // 비례 상수 업데이트
        torsoAngleStabilizerC = torsoAngleStabilizerGainSlider.value * 10; // 미분 상수 업데이트
    };

    // 몸통 각도 안정화 게인 슬라이더 입력 처리
    torsoAngleStabilizerGainSlider.oninput = function() {
        torsoAngleStabilizerK = this.value * 100; // 비례 상수 업데이트
        torsoAngleStabilizerC = this.value * 10; // 미분 상수 업데이트
        torsoStabilizerGainVal.innerHTML = "Strength: " + this.value; // 게인 값 표시 업데이트
    };

    // 몸통 수직 안정화 체크박스 입력 처리
    torsoVerticalStabilizerCheckbox.oninput = function() {
        torsoVerticalStabilization = torsoVerticalStabilizerCheckbox.checked; // 몸통 수직 안정화 사용 여부 업데이트
        torsoVerticalStabilizerGainSlider.hidden = !torsoVerticalStabilization; // 게인 슬라이더 숨김/표시
        torsoVertStabilizerGainVal.hidden = !torsoVerticalStabilization; // 게인 값 표시 숨김/표시
        torsoVertStabilizerGainVal.innerHTML = "Strength: " + torsoVerticalStabilizerGainSlider.value; // 게인 값 표시 업데이트
        torsoVerticalStabilizerK = torsoAngleStabilizerGainSlider.value * 0.6; // 비례 상수 업데이트
        torsoVerticalStabilizerC = torsoAngleStabilizerGainSlider.value * 0.06; // 미분 상수 업데이트
    };

    // 몸통 수직 안정화 게인 슬라이더 입력 처리
    torsoVerticalStabilizerGainSlider.oninput = function() {
        torsoVerticalStabilizerK = this.value * 0.6; // 비례 상수 업데이트
        torsoVerticalStabilizerC = this.value * 0.06; // 미분 상수 업데이트
        torsoVertStabilizerGainVal.innerHTML = "Strength: " + this.value; // 게인 값 표시 업데이트
    };

    // 시퀀스 실행 버튼 클릭 처리
    sequenceGoButton.onclick = function() {
        var sequenceStrArray = sequenceTextbox.value.split(','); // 텍스트 상자의 시퀀스를 배열로 분할
        actionQueue.clearAll(); // 액션 큐 초기화
        var currentKeyPos = 0; // 현재 키 순서 위치
        var keyOrder = [[false, false, false, false],
            [false, true, true, false], [false, false, false, false], [true, false, false, true]]; // 키 입력 순서 정의
        resetRunner(); // 달리기 선수 재설정
        // 시퀀스 배열을 순회하며 액션 큐에 추가
        for (let idx = 0; idx < sequenceStrArray.length; idx++) {
            actionQueue.addAction(new actions.Action(parseInt(sequenceStrArray[idx]),
                keyOrder[currentKeyPos][0],
                keyOrder[currentKeyPos][1],
                keyOrder[currentKeyPos][2],
                keyOrder[currentKeyPos][3])); // 새로운 액션 생성 및 큐에 추가
            currentKeyPos++; // 다음 키 순서 위치로 이동
            currentKeyPos %= 4; // 키 순서 반복
        }
    };


    // QWOP 및 R 키 리스너 (키 다운 이벤트)
    window.addEventListener('keydown', function(event) {
        switch (event.key) {
            case 'q':
                q = true; // Q 키 상태 true로 설정
                qbutton.style.borderStyle = "inset"; // 버튼 스타일 변경
                break;
            case 'w':
                w = true; // W 키 상태 true로 설정
                wbutton.style.borderStyle = "inset"; // 버튼 스타일 변경
                break;
            case 'o':
                o = true; // O 키 상태 true로 설정
                obutton.style.borderStyle = "inset"; // 버튼 스타일 변경
                break;
            case 'p':
                p = true; // P 키 상태 true로 설정
                pbutton.style.borderStyle = "inset"; // 버튼 스타일 변경
                break;
            case 'r':
                resetbutton.style.borderStyle = "inset"; // 버튼 스타일 변경
                resetRunner(); // 달리기 선수 재설정
                break;
        }
    }, false);

    // QWOP 및 R 키 리스너 (키 업 이벤트)
    window.addEventListener('keyup', function(event) {
        switch (event.key) {
            case 'q':
                q = false; // Q 키 상태 false로 설정
                qbutton.style.borderStyle = "outset"; // 버튼 스타일 변경
                break;
            case 'w':
                w = false; // W 키 상태 false로 설정
                wbutton.style.borderStyle = "outset"; // 버튼 스타일 변경
                break;
            case 'o':
                o = false; // O 키 상태 false로 설정
                obutton.style.borderStyle = "outset"; // 버튼 스타일 변경
                break;
            case 'p':
                p = false; // P 키 상태 false로 설정
                pbutton.style.borderStyle = "outset"; // 버튼 스타일 변경
                break;
            case 'r':
                resetbutton.style.borderStyle = "outset"; // 버튼 스타일 변경
                break;
        }
    }, false);

    // 모바일 터치 리스너 (터치 시작)
    qbutton.addEventListener('touchstart', function(event) {
        q= true; // Q 키 상태 true로 설정
        qbutton.style.borderStyle = "inset"; // 버튼 스타일 변경
    }, false);
    // 모바일 터치 리스너 (터치 종료)
    qbutton.addEventListener('touchend', function(event) {
        q= false; // Q 키 상태 false로 설정
        qbutton.style.borderStyle = "outset"; // 버튼 스타일 변경
    }, false);

    // 모바일 터치 리스너 (터치 시작)
    wbutton.addEventListener('touchstart', function(event) {
        w= true; // W 키 상태 true로 설정
        wbutton.style.borderStyle = "inset"; // 버튼 스타일 변경
    }, false);
    // 모바일 터치 리스너 (터치 종료)
    wbutton.addEventListener('touchend', function(event) {
        w= false; // W 키 상태 false로 설정
        wbutton.style.borderStyle = "outset"; // 버튼 스타일 변경
    }, false);

    // 모바일 터치 리스너 (터치 시작)
    obutton.addEventListener('touchstart', function(event) {
        o= true; // O 키 상태 true로 설정
        obutton.style.borderStyle = "inset"; // 버튼 스타일 변경
    }, false);
    // 모바일 터치 리스너 (터치 종료)
    obutton.addEventListener('touchend', function(event) {
        o= false; // O 키 상태 false로 설정
        obutton.style.borderStyle = "outset"; // 버튼 스타일 변경
    }, false);

    // 모바일 터치 리스너 (터치 시작)
    pbutton.addEventListener('touchstart', function(event) {
        p= true; // P 키 상태 true로 설정
        pbutton.style.borderStyle = "inset"; // 버튼 스타일 변경
    }, false);
    // 모바일 터치 리스너 (터치 종료)
    pbutton.addEventListener('touchend', function(event) {
        p= false; // P 키 상태 false로 설정
        pbutton.style.borderStyle = "outset"; // 버튼 스타일 변경
    }, false);

    // 모바일 터치 리스너 (터치 시작)
    resetbutton.addEventListener('touchstart', function(event) {
        resetRunner(); // 달리기 선수 재설정
        resetbutton.style.borderStyle = "inset"; // 버튼 스타일 변경
    }, false);
    // 모바일 터치 리스너 (터치 종료)
    resetbutton.addEventListener('touchend', function(event) {
        resetbutton.style.borderStyle = "outset"; // 버튼 스타일 변경
    }, false);

    // 마우스 다운 리스너
    resetbutton.addEventListener('mousedown', function(event) {
        resetRunner(); // 달리기 선수 재설정
        resetbutton.style.borderStyle = "inset"; // 버튼 스타일 변경
    }, false);

    // 마우스 업 리스너
    resetbutton.addEventListener('mouseup', function(event) {
        resetbutton.style.borderStyle = "outset"; // 버튼 스타일 변경
    }, false);

    setInterval(loop, frameDelay); // 게임 루프를 일정한 간격으로 실행
};

/*
신체의 모든 사각형을 순서대로 렌더링한다.
for문 안의 body값에 따른 이미지 순서(계획중):
0 = /foot_r.png
1 = /foot_l.png
2 = /leg_r_lower.png
3 = /leg_l_lower.png
4 = /leg_r_upper.png
5 = /leg_l_upper.png
6 = /body.png
7 = /arm_r_upper.png
8 = /arm_l_upper.png
9 = /arm_r_lower.png
10 = /arm_l_lower.png
*/
// function renderAllParts(bodyVerts) {
//     for(body = 0; body < bodyVerts.bodyVerts.length; body++) {
//         var poly = bodyVerts.bodyVerts[body];
//         ctx.beginPath(); // 새로운 경로 시작
//         ctx.moveTo(scaling * (poly[0] - runnerX) + xOffset, scaling * poly[1] + yOffset); // 시작점 설정
//         let item;
//         for (item = 2; item < poly.length - 1; item += 2) {
//             // 각 정점으로 선 그리기.
//             // poly는 [x1, y1, x2, y2, x3, y3, x4, y4] 형식으로 되어 있고 각각의 좌표를 line으로 찍는다.
//             ctx.lineTo(scaling * (poly[item] - runnerX) + xOffset, scaling * poly[item + 1] + yOffset);
//         }
//         // poly를 닫고 사각형을 fill로 채운다.
//         ctx.closePath(); // 경로 닫기
//         ctx.fill(); // 내부 채우기
//         console.log(`번호 = ${body},\npoly = `, bodyVerts.bodyVerts[body]);
//     }
//     debugger;
// }


// function renderAllParts(bodyVerts) {
//     for (let body = 0; body < bodyVerts.bodyVerts.length; body++) {
//         const poly = bodyVerts.bodyVerts[body];
//
//         // 4개의 꼭짓점 좌표
//         const [x1, y1, x2, y2, x3, y3, x4, y4] = poly;
//
//         // 중심 좌표 계산
//         const centerX = (x1 + x2 + x3 + x4) / 4;
//         const centerY = (y1 + y2 + y3 + y4) / 4;
//
//         // X축 방향 벡터 (x1 -> x2)
//         const dx = x2 - x1;
//         const dy = y2 - y1;
//
//         // 스케일 계산 (길이 측정)
//         const scaleX = Math.sqrt(dx * dx + dy * dy) / 100;
//         const dx2 = x4 - x1;
//         const dy2 = y4 - y1;
//         const scaleY = Math.sqrt(dx2 * dx2 + dy2 * dy2) / 100;
//
//         // 회전 각도 계산 (x축 기준)
//         const angle = Math.atan2(dy, dx);
//
//         // 변환 시작
//         ctx.save();
//         ctx.translate(scaling * (centerX - runnerX) + xOffset, scaling * centerY + yOffset); // 중심으로 이동
//         ctx.rotate(angle);                         // 회전
//         ctx.scale(scaleX * scaling, scaleY * scaling); // 크기 조절 (배율 적용 포함)
//
//         // 기준 사각형(100x100)을 기준으로 그리기 (중심 기준으로 -50, -50)
//         ctx.beginPath();
//         ctx.rect(-50, -50, 100, 100);
//         ctx.fill();
//         ctx.restore();
//
//         // console.log(`번호 = ${body},\npoly = `, poly);
//     }
//     // debugger;
// }
function renderAllParts(bodyVerts) {
    // 원하는 순서 정의
    const order = [8, 10, ...Array.from({ length: bodyVerts.bodyVerts.length }, (_, i) => i).filter(i => i !== 8 && i !== 10).sort((a, b) => a - b)];

    for (let i = 0; i < order.length; i++) {
        const body = order[i];
        const poly = bodyVerts.bodyVerts[body];
        if (!images[body].complete) continue; // 아직 이미지가 로드되지 않았으면 건너뜀

        const [x1, y1, x2, y2, x3, y3, x4, y4] = poly;

        // 중심 좌표
        const centerX = (x1 + x2 + x3 + x4) / 4;
        const centerY = (y1 + y2 + y3 + y4) / 4;

        // x축 방향 벡터
        const dx = x2 - x1;
        const dy = y2 - y1;

        const dx2 = x4 - x1;
        const dy2 = y4 - y1;

        // 스케일 계산
        const scaleX = Math.sqrt(dx * dx + dy * dy) / 100 * imaegScalesX[body];
        const scaleY = Math.sqrt(dx2 * dx2 + dy2 * dy2) / 100 * imaegScalesY[body];

        // 회전 각도 계산
        const angle = Math.atan2(dy, dx);

        // 변환 및 이미지 렌더
        ctx.save();
        ctx.translate(scaling * (centerX - runnerX) + xOffset, scaling * centerY + yOffset);
        ctx.rotate(angle);
        ctx.scale(scaleX * scaling, scaleY * scaling);

        ctx.drawImage(images[body], -50 + imageOffsetsX[body], -50 + imageOffsetsY[body], 100, 100);
        ctx.restore();
    }
}

// 머리 각도 계산
function calculateHeadAngle(bodyVerts) {
    const headX = scaling * (bodyVerts.headLocAndRadius[0] - runnerX) + xOffset;
    const headY = scaling * bodyVerts.headLocAndRadius[1] + yOffset;

    const bodyPoly = bodyVerts.bodyVerts[6]; // 몸통 기준
    const bodyCenterX = scaling * ((bodyPoly[0] + bodyPoly[2] + bodyPoly[4] + bodyPoly[6]) / 4 - runnerX) + xOffset;
    const bodyCenterY = scaling * ((bodyPoly[1] + bodyPoly[3] + bodyPoly[5] + bodyPoly[7]) / 4) + yOffset;

    const dx = headX - bodyCenterX;
    const dy = headY - bodyCenterY;
    const angleToHead = Math.atan2(dy, dx); // 머리까지의 방향

    const bodyDx = bodyPoly[2] - bodyPoly[0]; // 몸통의 윗쪽 벡터 기준 (x2 - x1)
    const bodyDy = bodyPoly[3] - bodyPoly[1]; // (y2 - y1)
    const bodyAngle = Math.atan2(bodyDy, bodyDx); // 몸통의 기본 방향

    // 각도 차이 제한: ±30도 (π/6 라디안)
    const maxDelta = Math.PI / 6;
    let angleDiff = angleToHead - bodyAngle;

    // -π ~ π 범위로 보정
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // 제한 적용
    if (angleDiff > maxDelta) angleDiff = maxDelta;
    if (angleDiff < -maxDelta) angleDiff = -maxDelta;

    return bodyAngle + angleDiff;
}


// 머리 렌더링
function renderHead(bodyVerts) {
    const headImage = new Image();
    headImage.src = '/hgop_head.png';

    const headX = scaling * (bodyVerts.headLocAndRadius[0] - runnerX) + xOffset;
    const headY = scaling * bodyVerts.headLocAndRadius[1] + yOffset;

    const angle = calculateHeadAngle(bodyVerts);

    const newHeadWidth = 100;
    const newHeadHeight = 100;

    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(angle);
    ctx.drawImage(headImage, -newHeadWidth / 2 - 30, -newHeadHeight / 2 + 25, newHeadWidth, newHeadHeight);
    ctx.restore();

}

// 머리 렌더
// function renderHead(bodyVerts) {
//     // 머리 이미지를 그립니다.
//     var headImage = new Image();
//     headImage.src = '/hgop_head.png';
//
//
//
//     var headRadius = scaling * bodyVerts.headLocAndRadius[2];
//     var headX = scaling * (bodyVerts.headLocAndRadius[0] - runnerX) + xOffset;
//     var headY = scaling * bodyVerts.headLocAndRadius[1] + yOffset;
//     var newHeadWidth = 100; // 원하는 너비
//     var newHeadHeight = 100; // 원하는 높이
//     ctx.rotate();
//     ctx.drawImage(headImage, headX - 80, headY - 30, newHeadWidth, newHeadHeight);
//     ctx.restore();
// }

// function renderHead(bodyVerts) {
//     const headImage = new Image();
//     headImage.src = '/hgop_head.png';
//
//     // 이미지 로드 완료 후 draw
//     headImage.onload = function () {
//         const headX = scaling * (bodyVerts.headLocAndRadius[0] - runnerX) + xOffset;
//         const headY = scaling * bodyVerts.headLocAndRadius[1] + yOffset;
//
//         const bodyPoly = bodyVerts.bodyVerts[6]; // body 중심 좌표는 body index 6번 기준
//         const bodyCenterX = scaling * ((bodyPoly[0] + bodyPoly[2] + bodyPoly[4] + bodyPoly[6]) / 4 - runnerX) + xOffset;
//         const bodyCenterY = scaling * ((bodyPoly[1] + bodyPoly[3] + bodyPoly[5] + bodyPoly[7]) / 4) + yOffset;
//
//         // 회전 각도 계산
//         const dx = headX - bodyCenterX;
//         const dy = headY - bodyCenterY;
//         const angle = Math.atan2(dy, dx);
//
//         // 머리 이미지 크기
//         const newHeadWidth = 100;
//         const newHeadHeight = 100;
//
//         // 회전 및 출력
//         ctx.save();
//         ctx.translate(headX, headY);     // 중심으로 이동
//         ctx.rotate(angle);               // 회전 적용
//         ctx.drawImage(headImage, -newHeadWidth / 2, -newHeadHeight / 2, newHeadWidth, newHeadHeight);
//         ctx.restore();
//     };
// }


setup(); // 초기 설정 실행
