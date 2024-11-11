import {$joinRoomMenu, domain, isDebugMode} from "../../public/scripts/global";
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