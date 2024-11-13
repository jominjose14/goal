import {$canvas, $joinRoomMenu, domain, isDebugMode, state} from "../../public/scripts/global";
import {startLoading, stopLoading} from "../../public/scripts/functions";

export async function getRoomList() {
    const $errorMsg = $joinRoomMenu.querySelector(".error-msg");
    const protocol = isDebugMode ? "http" : "https";
    let response = null;

    try {
        startLoading();
        response = await fetch(`${protocol}://${domain}/rooms`);
    } catch(err) {
        console.error("Failed to fetch joinable rooms list. Reason: ", err);
        $errorMsg.textContent = "Failed to fetch rooms";
        stopLoading();
        return;
    }

    if(response !== null && response.ok) {
        const roomList = await response.json();
        if(roomList.length === 0) {
            $errorMsg.textContent = "No rooms available";
            return;
        }

        $errorMsg.textContent = "";
        const $joinableRoomList = $joinRoomMenu.querySelector(".join-room-list");
        const $joinableRoomTemplate = document.getElementById("joinable-room-template");

        $joinableRoomList.innerHTML = "";
        for(const room of roomList) {
            const $room = $joinableRoomTemplate.content.cloneNode(true);
            $room.querySelector(".joinable-room-name").textContent = room.roomName;

            const $leftTeamBtn = $room.querySelector(".joinable-room-team-btn[data-team='left']");
            $leftTeamBtn.dataset.roomName = room.roomName;
            if(!room.canJoinLeftTeam) $leftTeamBtn.disabled = true;
            if(room.canJoinLeftTeam) $leftTeamBtn.onclick = (event) => onClickJoinRoomBtn(event);

            const $rightTeamBtn = $room.querySelector(".joinable-room-team-btn[data-team='right']");
            $rightTeamBtn.dataset.roomName = room.roomName;
            if(!room.canJoinRightTeam) $rightTeamBtn.disabled = true;
            if(room.canJoinRightTeam) $rightTeamBtn.onclick = (event) => onClickJoinRoomBtn(event);

            $joinableRoomList.appendChild($room);
        }
    } else {
        $errorMsg.textContent = "Something went wrong";
    }

    stopLoading();
}

function handleGoal() {
    const yGoalStart = (320/900) * $canvas.height + 2 * state.puck.radius;
    const yGoalEnd = (580/900) * $canvas.height - 2 * state.puck.radius;
    // state.puck.xVel = Math.sign(state.puck.xVel) * Math.max(7 * fps/60, state.puck.xVel);
    if(Math.abs(state.puck.yPos - yGoalStart) < 0.01 * $canvas.height || Math.abs(state.puck.yPos - yGoalEnd) < 0.01 * $canvas.height) state.puck.yVel *= -1;
}

// this prevents puck from appearing above vertical rink lines as it passes into goal when coming in at a steep angle
function redrawVerticalRinkLines() {
    const rinkRadius = (60/900) * $canvas.height;
    const ctx = state.context;

    ctx.beginPath();

    ctx.moveTo((5/1600) * $canvas.width,rinkRadius + (5/900) * $canvas.height);
    ctx.lineTo((5/1600) * $canvas.width,(319/900) * $canvas.height - rinkRadius);

    ctx.moveTo((5/1600) * $canvas.width,rinkRadius + (581/900) * $canvas.height);
    ctx.lineTo((5/1600) * $canvas.width,(895/900) * $canvas.height - rinkRadius);

    ctx.moveTo((1595/1600) * $canvas.width,rinkRadius + (5/900) * $canvas.height);
    ctx.lineTo((1595/1600) * $canvas.width,(319/900) * $canvas.height - rinkRadius);

    ctx.moveTo((1595/1600) * $canvas.width,rinkRadius + (581/900) * $canvas.height);
    ctx.lineTo((1595/1600) * $canvas.width,(895/900) * $canvas.height - rinkRadius);

    ctx.lineWidth = (11/1600) * $canvas.width;
    ctx.strokeStyle = "hsla(0, 0%, 30%, 1)";
    ctx.stroke();

    ctx.closePath();
}