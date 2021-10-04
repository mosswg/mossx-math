const bg_color = "#212529";
const text_color = "#6c757d";

var font_name;
const font_size = 30;


const selection_alpha = 0.35;
var something_is_selected = false;

var max_height = 0;
var max_width = 0;

const cursor_blink_speed = 500;


class point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}


const letter_space = new point(0, 5);
const default_position = new point(15, 25);


var g_text_buffer = [[]];
var g_cursor_position = new point(0, 0);
var g_cursor_visible = true;
var g_cursor_interval;
var g_cursor_size = new point(0, 0);
var g_letter_spacing;
var g_canvas;
var g_ctx;


class key_press {
    constructor(key) {
        this.key = key;
        this.selected = false;
    }
}

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function calculate_text_size(string) {
    return g_ctx.measureText(string);
}

function set_cursor_position(x, y) {
    y = clamp(y, 0, g_text_buffer.length-1);
    x = clamp(x, 0, g_text_buffer[y].length);

    console.log(x, y);

    g_cursor_position.x = x;
    g_cursor_position.y = y;
    reload_buffer();
    draw_cursor();
    clearInterval(g_cursor_interval);
    g_cursor_interval = setInterval(draw_cursor, cursor_blink_speed);
}

function increment_cursor_position(x, y) {
    y = clamp(y, -g_cursor_position.y, g_text_buffer.length-1);
    x = clamp(x, -g_cursor_position.x, g_text_buffer[g_cursor_position.y + y].length - g_cursor_position.x);

    console.log('x: ' + x + ' y: ' + y)

    g_cursor_position.x += x;
    g_cursor_position.y += y;
    reload_buffer();
    draw_cursor();
    clearInterval(g_cursor_interval);
    g_cursor_interval = setInterval(draw_cursor, cursor_blink_speed);
}

function cursor_x_to_pixels(x) {
    return x * g_letter_spacing + default_position.x;
}

function pixel_x_to_cursor(x) {
    return (x - default_position.x) / g_letter_spacing;
}

function cursor_y_to_pixels(y) {
    return y * g_cursor_size.y + default_position.y;
}

function pixel_y_to_cursor(y) {
    return (y - default_position.y) / g_cursor_size.y;
}

function get_cursor_x_in_pixels() {
    return cursor_x_to_pixels(g_cursor_position.x);
}
function get_cursor_y_in_pixels() {
    return cursor_y_to_pixels(g_cursor_position.y);
}

function insert_letter_at_cursor(key) {
    g_text_buffer[g_cursor_position.y].splice(g_cursor_position.x, 0, new key_press(key));
    increment_cursor_position(1, 0);
    reload_buffer();
}

function set_text_selected(from, to, selected = true) {
    for (var i = from.y; i < to.y; i++) {
        for (var j = from.x; j < to.x; j++) {
            g_text_buffer[i][j].selected = selected;
        }
    }
}

function select_row(row, selected = true) {
    for (var i = 0; i < g_text_buffer[row].length; i++) {
        g_text_buffer[row][i].selected = selected;
    }
}

function deselect_text() {
    for (var i = 0; i < g_text_buffer.length; i++) {
        for (var j = 0; j < g_text_buffer[i].length; j++) {
            g_text_buffer[i][j].selected = false;
        }
    }
    something_is_selected = false;
    reload_buffer();
}

function delete_selected() {
    if (something_is_selected) {
        for (var i = 0; i < g_text_buffer.length; i++) {
            for (var j = 0; j < g_text_buffer[i].length; j++) {
                if (g_text_buffer[i][j].selected) {
                    g_text_buffer[i].splice(j--, 1);
                }
            }
        }
    }
}

function draw_cursor() {
    if (g_cursor_visible) {
        g_ctx.beginPath();
        g_ctx.rect(get_cursor_x_in_pixels() - (g_letter_spacing/2 + g_cursor_size.x), get_cursor_y_in_pixels() - g_cursor_size.y, g_cursor_size.x, g_cursor_size.y);
        g_ctx.fill();
    }
    else {
        g_ctx.clearRect(get_cursor_x_in_pixels() - (g_letter_spacing/2 + g_cursor_size.x), get_cursor_y_in_pixels() - g_cursor_size.y, g_cursor_size.x, g_cursor_size.y);
    }

    g_cursor_visible = !g_cursor_visible;
}

function draw_selection(start_point, end_point) {
    if (start_point.x !== -1 && start_point.y !== -1) {
        g_ctx.globalAlpha = selection_alpha;
        g_ctx.beginPath();
        g_ctx.rect(cursor_x_to_pixels(start_point.x)-g_letter_spacing/2, cursor_y_to_pixels(start_point.y) - max_height, cursor_x_to_pixels(end_point.x) + g_letter_spacing/2, (end_point.y + 1) * g_cursor_size.y);
        g_ctx.fill();
        g_ctx.globalAlpha = 1;
        console.log(start_point);
        console.log(end_point);
    }
}

function reload_buffer() {
    const pushed_cursor_position_x = g_cursor_position.x;
    const pushed_cursor_position_y = g_cursor_position.y;
    g_cursor_position.x = 0, g_cursor_position.y = 0;

    // Write key presses to the canvas.
    g_ctx.clearRect(0, 0, window.innerWidth*2, window.innerHeight*2); // Clear the canvas
    for (var i = 0; i < g_text_buffer.length; i++) {
        for (var j = 0; j < g_text_buffer[i].length; j++) {
            write_key(g_text_buffer[i][j].key, false); // Simulate the key presses of the buffer without appending to the buffer
        }
        g_cursor_position.y++;
        g_cursor_position.x = 0;
    }

    g_cursor_position.x = pushed_cursor_position_x;
    g_cursor_position.y = pushed_cursor_position_y;

    // Highlight Selected Text
    var start_point = new point(-1, -1);
    var end_point = new point(-1, -1);
    for (var i = 0; i < g_text_buffer.length; i++) {
        for (var j = 0; j < g_text_buffer[i].length; j++) {
            if (g_text_buffer[i][j].selected) {
                if (start_point.x === -1 && start_point.y === -1) {
                    start_point.x = i;
                    start_point.y = j;
                }
                end_point.x = i;
                end_point.y = j;
            }
            else {
                draw_selection(start_point, end_point);
                start_point.x = -1;
                start_point.y = -1;
            }
        }
    }
    draw_selection(start_point, end_point);
}

function calculate_max_letter_size() { 
    for (var i = 'a'; i <= 'z'; i = String.fromCharCode(i.charCodeAt(0) + 1)) {
        letter_size = calculate_text_size(i);
        height = letter_size.actualBoundingBoxAscent - letter_size.actualBoundingBoxDescent;
        if (height > max_height) {
            max_height = height;
        }
    }
}

function key_pressed_listener(e) {
    key_pressed(e, true);
}


function mouse_click_listener(e) {
    deselect_text();
    rect = g_canvas.getBoundingClientRect()
    var mouse_x = e.clientX - rect.left;
    var mouse_y = e.clientY - rect.top;

    set_cursor_position(Math.round(pixel_x_to_cursor(mouse_x)), Math.round(pixel_y_to_cursor(mouse_y)));
}

function key_pressed(key, append_to_buffer) {
    if (key.ctrlKey) {
        if (key.key == 'a') {
            for (var i = 0; i < g_text_buffer.length; i++) {
                for (var j = 0; j < g_text_buffer[i].length; j++) {
                    g_text_buffer[i][j].selected = true;
                }
            }
            something_is_selected = true;
            reload_buffer();
        }

        return;
    }
    
    if (key.shiftKey) {
        if (key.key == 'ArrowLeft') {
            g_text_buffer[g_cursor_position.y][g_cursor_position.x-1].selected = true;
            something_is_selected = true;
            increment_cursor_position(-1, 0);
        }
    }


    if (key.key.length != 1 && key.key.startsWith("F")) { // Ignore function keys
        return;
    }
    if (key.key.startsWith("Arrow")) {
        if (something_is_selected) {
            if (key.key == 'ArrowRight') {
                set_cursor_position(1, 0);
            }
            else if (key.key == 'ArrowLeft') {
                increment_cursor_position(-1, 0);
            }
            else if (key.key == 'ArrowUp') {
                increment_cursor_position(0, 1);
            }
            else if (key.key == 'ArrowDown') {
                increment_cursor_position(0, -1);
            }
            deselect_text();
        }
        else {
            if (key.key == 'ArrowRight') {
                increment_cursor_position(1, 0);
            }
            else if (key.key == 'ArrowLeft') {
                increment_cursor_position(-1, 0);
            }
            else if (key.key == 'ArrowUp') {
                increment_cursor_position(0, 1);
            }
            else if (key.key == 'ArrowDown') {
                increment_cursor_position(0, -1);
            }
        }
    }
    else {
        write_key(key.key, append_to_buffer);
    }


}

function write_key(key, append_to_buffer) {
    switch (key) {
        case "Enter":
            if (append_to_buffer) {
                g_text_buffer.splice(g_cursor_position.y + 1, 0, []);
                var next_line_length = g_text_buffer[g_cursor_position.y + 1].length
                if (g_cursor_position.x !== g_text_buffer[g_cursor_position.y].length-1) {   // If the cursor is not at the end of the buffer move everything after 
                                                                        // the cursor to the new line.
                    var after_newline = g_text_buffer[g_cursor_position.y].slice(g_cursor_position.x);
                    g_text_buffer[g_cursor_position.y + 1].push.apply(g_text_buffer[g_cursor_position.y + 1], after_newline);
                    g_text_buffer[g_cursor_position.y].splice(g_cursor_position.x, after_newline.length);
                }
                set_cursor_position(next_line_length, g_cursor_position.y + 1);
            }
            else {
                g_cursor_position.y++;
                g_cursor_position.x = 0;
            }
            return;
        case "Backspace":
            if (something_is_selected) {
                delete_selected()
            }
            else {
                if (g_cursor_position.x === 0 && g_cursor_position.y === 0) { return; } // Ignore a backspace at the beginning of the screen
                if (g_cursor_position.x === 0) {
                    previous_line_length = g_text_buffer[g_cursor_position.y - 1].length;
                    g_text_buffer[g_cursor_position.y - 1].push.apply(g_text_buffer[g_cursor_position.y-1], g_text_buffer[g_cursor_position.y]);
                    g_text_buffer.splice(g_cursor_position.y, 1);
                    set_cursor_position(previous_line_length, g_cursor_position.y - 1);
                }
                else {
                    g_text_buffer[g_cursor_position.y].splice(g_cursor_position.x-1, 1);
                    increment_cursor_position(-1, 0);
                }
            }
            reload_buffer();
            return;
        case "Delete":
            if (something_is_selected) {
                delete_selected();
            }
            else {
                g_text_buffer[g_cursor_position.y].splice(g_cursor_position.x + 1, 1);
                if (g_cursor_position.x === 0) {
                    previous_line_length = g_text_buffer[g_cursor_position.y - 1].length;
                    g_text_buffer[g_cursor_position.y + 1].push.apply(g_text_buffer[g_cursor_position.y + 1], g_text_buffer[g_cursor_position.y]);
                    g_text_buffer.splice(g_cursor_position.y, 1);
                    set_cursor_position(previous_line_length, g_cursor_position.y + 1);
                }
                else {
                    increment_cursor_position(1, 0);
                }
            }
            reload_buffer();
            return;
        case " ":
            if (append_to_buffer) {
                insert_letter_at_cursor(key);
            }
            else {
                g_cursor_position.x++;
            }
            return;

        case "CapsLock":
            return;

        default:
            console.log(get_cursor_y_in_pixels());
            g_ctx.fillText(key, get_cursor_x_in_pixels(), get_cursor_y_in_pixels());
            if (append_to_buffer) {
                insert_letter_at_cursor(key);
            }
            else {
                g_cursor_position.x++;
            }
            return;
    }
}

function load() {
    document.querySelector("#editor").width = window.innerWidth - (window.innerWidth/10);   // Set the width of the canvas to the width of the window - 10%
    document.querySelector("#editor").height = window.innerHeight-(window.innerHeight/10);  // Same with the height
    g_canvas = document.getElementById("editor");
    g_ctx = g_canvas.getContext('2d');

    window.addEventListener('keydown', key_pressed_listener, false);
    window.addEventListener('mousedown', mouse_click_listener);

    font_first_space = g_ctx.font.indexOf(' ');
    font_name = g_ctx.font.substring(font_first_space + 1);

    g_ctx.font = font_size + "px " + font_name;
    g_ctx.fillStyle = text_color;
    g_ctx.imageSmoothingEnabled = false;
    g_ctx.textAlign = "center";

    calculate_max_letter_size();

    g_letter_spacing = calculate_text_size('w').width;
    g_cursor_size.y = max_height;
    g_cursor_size.x = 2;

    g_cursor_interval = setInterval(draw_cursor, cursor_blink_speed);
}