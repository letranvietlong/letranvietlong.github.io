(function ($) {
    var caro = function () {
        var self = this;
        this.cell_minpx = 25;
        this.runtime_minute = $(".game_runtime.minute");
        this.runtime_second = $(".game_runtime.second");
        this.runtime_minute_value = 0;
        this.runtime_second_value = 0;
        this.runtime_timeout = '';
        this.runtime = function(){
            this.runtime_second_value ++;
            if (this.runtime_second_value >= 59){
                this.runtime_second_value = 0;
                this.runtime_minute_value ++;
            }
            this.runtime_minute.html(this.runtime_minute_value);
            this.runtime_second.html(this.runtime_second_value);
            this.runtime_timeout = setTimeout(function(){
                self.runtime();
            }, 1000);
        };
        this.data = {
            cell_w: 0,
            cell_h: 0,
            cell_pixel_w : 0,
            cell_pixel_h : 0,
            status: 'ready', //ready, wait_user, wait_machine, person_win, machine_win
            trongso_max_person: 0,
            trongso_max_machine: 0,
            trongso_add: [0, 1, 2, 10, 20]
        };

        this.render_cell = function () {
            var str = '';
            for (i = 0; i < this.data.cell_h; i++) {
                for (j = 0; j < this.data.cell_w; j++) {
                    str += "<div class='display_inline_block game_cell' id='game_cell_" + j + "_" + i + "' data-x='" + j + "' data-y='" + i + "' data-trongso-person='0' data-trongso-machine='0'></div>";
                }
            }
            $("#game_content").html(str + "<div class='clear_both'></div>");
            $("#game_content .game_cell").css({
                'width': this.data.cell_pixel_w + 'px',
                'height': this.data.cell_pixel_h + 'px'
            });
            this.data.status = 'wait_user';
            $(".game_cell").click(function () {
                self.user_check(this);
            });
        };
        this.cell_check = function (slt, obj) {
            this.data.current_check = $(slt);
            $(slt).addClass(obj);
            if (obj === 'person') {
                this.data.status = 'wait_machine';
            } else {
                this.data.status = 'wait_user';
                $(slt).addClass('currentcheck');
                setTimeout(function () {
                    $(slt).removeClass('currentcheck');
                }, 1000);
            }
            this.checkwin(slt, obj);
        };
        this.user_check = function (slt) {
            console.log("********************");
            console.log("nguoi choi di");
            if ($(slt).hasClass('machine') || $(slt).hasClass('person')) {
                console.log("Không được đánh vào ô đã có sẵn !");
                return;
            } else {
                if (this.data.status === 'wait_user') {
                    this.cell_check(slt, 'person');
                    console.log("Người chơi đi xong");
                    this.machine_check();
                } else {
                    console.log("Chưa đến lượt người chơi");
                }
            }
        };
        this.machine_check = function () {
            console.log("may di");
            if (this.data.status === 'wait_machine') {
                //1. tao trong so cho tat ca cac o
                $(".game_cell").attr("data-trongso-person", 0);
                $(".game_cell").attr("data-trongso-machine", 0);
                this.data.trongso_max_person = 0;
                this.data.trongso_max_machine = 0;
                var ar_nocheck = $(".game_cell:not(.person):not(.machine)");
                if (ar_nocheck !== undefined) {
                    $.each(ar_nocheck, function (index, value) {
                        self.taotrongso(this, 'machine');
                        self.taotrongso(this, 'person');
                    });
                    //2. chon cac o co trong so lon nhat, lay ngau nhien 1 o
                    if (this.data.trongso_max_machine >= this.data.trongso_max_person) {
                        var cell_max = $(".game_cell[data-trongso-machine='" + this.data.trongso_max_machine + "']");
                        var second_obj = 'person';
                    } else {
                        var cell_max = $(".game_cell[data-trongso-person='" + this.data.trongso_max_person + "']");
                        var second_obj = 'machine';
                    }
                    if (cell_max !== undefined) {
                        var trongso_second = 0;
                        $.each(cell_max, function (index, value) {
                            var t = ($(this).attr("data-trongso-" + second_obj))*1;
                            if (t > trongso_second){
                                trongso_second = t;
                            }
                        });
                        var ar = [];
                        $.each(cell_max, function (index, value) {
                            if ($(this).attr("data-trongso-" + second_obj)*1 === trongso_second){
                                ar.push(this);
                            }
                        });
                        var cell_select = randomInArray(ar);
                        if (cell_select !== false) {
                            this.cell_check($(cell_select), 'machine');
                        } else {
                            alert("no cell to machine check");
                        }
                    } else {
                        alert("no cell max to machine check");
                    }
                } else {
                    this.endgame();
                }
                console.log("Máy đi xong");
            } else {
                console.log("Chưa đến lượt của bạn");
            }

        };
        this.doithu = function(obj){
            if (obj.trim() === ''){
                return '';
            }
            if (obj === 'person'){
                return 'machine';
            }
            if (obj === 'machine'){
                return 'person';
            }
        };
        this.valid_cell_coor = function (x, y) {
            return !(x < 0 || y < 0 || x >= this.data.cell_x || y >= this.data.cell_y);
        };
        this.taotrongso = function (slt, obj) {
            var trongso = 0;
            var cx = $(slt).attr("data-x") * 1.0;
            var cy = $(slt).attr("data-y") * 1.0;
            var ilenght = this.data.trongso_add.length;

            for (var y = -1; y <= 1; y++) {
                for (var x = -1; x <= 1; x++) {
                    var nextcheck = true;
                    for (var i = 1; i < ilenght; i++) {
                        if (nextcheck === true 
                                && this.valid_cell_coor(cx + i * x, cy + i * y) === true
                                && this.valid_cell_coor(cx + (i+1) * x, cy + (i+1) * y) === true){
                            if ($("#game_cell_" + (cx + i * x) + "_" + (cy + i * y)).hasClass(obj)
                                    && ! $("#game_cell_" + (cx + (i+1) * x) + "_" + (cy + (i+1) * y)).hasClass(this.doithu(obj))) {
                                trongso += this.data.trongso_add[i];
                            } else {
                                nextcheck = false;
                            }
                        } else {
                            nextcheck = false;
                        }
                    }
                }
            }
            if (obj === 'person') {
                if (trongso > this.data.trongso_max_person) {
                    this.data.trongso_max_person = trongso;
                }
            } else {
                if (trongso > this.data.trongso_max_machine) {
                    this.data.trongso_max_machine = trongso;
                }
            }

            $(slt).attr("data-trongso-" + obj, trongso);
        };
        this.checkwin = function (slt, obj) {
            var cx = $(slt).attr("data-x") * 1.0;
            var cy = $(slt).attr("data-y") * 1.0;
            var delta = [
                {x: 1, y: -1},
                {x: 1, y: 0},
                {x: 1, y: 1},
                {x: 0, y: 1}
            ];
            var ldelta = delta.length;
            
            for (var i = 0; i < ldelta; i++) {
                var cell1 = {x: cx, y: cy};
                var cell2 = {x: cx, y: cy};
                var mark = 1;
                var stt = 1;
                while (this.valid_cell_coor(cx + stt * delta[i].x, cy + stt * delta[i].y)
                        && $("#game_cell_" + (cx + stt * delta[i].x) + "_" + (cy + stt * delta[i].y)).hasClass(obj)
                        ) {
                    cell1.x = cx + stt * delta[i].x;
                    cell1.y = cy + stt * delta[i].y;
                    stt++;
                    mark ++;
                }
                var stt = 1;
                while (this.valid_cell_coor(cx - stt * delta[i].x, cy - stt * delta[i].y)
                        && $("#game_cell_" + (cx - stt * delta[i].x) + "_" + (cy - stt * delta[i].y)).hasClass(obj)
                        ) {
                    cell2.x = cx - stt * delta[i].x;
                    cell2.y = cy - stt * delta[i].y;
                    stt++;
                    mark ++;
                }
                if (mark >= 5) {
                    this.win(cell1, cell2, obj, mark);
                }
            }
        };
        this.win = function (cell1, cell2, obj, mark) {
            this.data.status = obj + "_win";
            var delta = {
                x: (cell2.x - cell1.x) / (mark - 1),
                y: (cell2.y - cell1.y) / (mark - 1)
            };
            for (var i = 0; i < mark; i++) {
                $("#game_cell_" + (cell1.x + i * delta.x) + "_" + (cell1.y + i * delta.y)).addClass('win');
            }
            this.endgame();
        };
        this.start = function () {
            this.data.status = 'ready';
            var gamecontent = $("#game_content");
            var w = gamecontent.width();
            var h = gamecontent.height();
            var bh = $(window).height();
            if (h > bh){
                h = bh;
                gamecontent.css({'height':h+'px'});
            }
            this.data.cell_w = Math.floor(w / this.cell_minpx);
            this.data.cell_h = Math.floor(h / this.cell_minpx);
            this.data.cell_pixel_w = w / this.data.cell_w;
            this.data.cell_pixel_h = h / this.data.cell_h;
            this.render_cell();
            this.runtime_minute.html("00");
            this.runtime_second.html('00');
            this.runtime_minute_value = 0;
            this.runtime_second_value = 0;
            clearTimeout(this.runtime_timeout);
            this.runtime();
        };
        this.endgame = function () {
            console.log("Trò chơi kết thúc!");
            alert('Trò chơi kết thúc!');
            clearTimeout(this.runtime_timeout);
        };
        this.start();
        /*
         * Bat su kien cac nut nhan trong game
         */
        $(".btn-restartgame").click(function () {
            self.start();
        });
    };
    new caro();
})($);

function randomInteger(a, b) {
    return a + Math.floor(Math.random() * (b - a));
}
function randomInArray(ar){
    var l = ar.length;
    if(l < 1){
        return false;
    } else {
        var rand = randomInteger(0, l - 1);
        var re = false;
        $.each(ar, function(index, value){
            if (index === rand){
                re = this;
            }
        });
        return re;
    }
}