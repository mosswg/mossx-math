import { g_cursor_position as cursor, write_text, g_ctx, point, cursor_x_to_pixels, cursor_y_to_pixels } from "./math-editor.js"


export function create_symbol(id, row, column) {
    return new symbol_constructors[id](row, column);
}

export function is_valid(symbol) { 
    if (symbol.draw !== undefined) {
        return true;
    }

    return symbol_constructors[symbol] !== undefined;
}


export class math_symbol {
    row;
    column;
    name;
    args = [];

    constructor(row, column, name) {
        if (row === undefined) {
            this.row = cursor.y;
        }
        else {
            this.row = row;
        }
        if (column === undefined) {
            this.column = cursor.x;
        }
        else {
            this.column = column;
        }
        this.name = name;
        //g_text_buffer[this.row].text.splice(this.column, 0, this);
    }

    displayed_length() { math_symbol.instance_error();  return 0; }

    insert(element, pos, arg) {
        this.args[arg].splice(pos, 0, element);
    }

    delete(pos, arg) {
        this.args[arg].splice(pos, 1);
    }

    
    // TODO: SCALE BEFORE CALLING THIS METHOD
    draw(row, column) { math_symbol.instance_error(); }

    get_pos_from_cursor() { 
        if (cursor.y !== this.row) {
            return -1;
        }

        return cursor.x - this.column; 
    }

    get_cursor_scale(pos, arg) { return new point(1, 1); }

    get_cursor_offset(pos, arg) { return new point(0, 0); }

    to_string() { 
        var out = this.name;
        for (var i = 0; i < this.args.length; i++) {
            out += "{";
            for (var j = 0; j < this.args[i].length; j++) {
                out += this.args[i][j];
            }
            out += "}";
        }
        return out;
    }

    static instance_error() {
        console.log("ERROR: Instance of base symbol is not supported");
    }
}


export class nrt extends math_symbol {
    constructor(row, column) { 
        super(row, column, "\\nrt");
        this.args.push([], []);
    }

    displayed_length() {
        return this.args[0].length + this.args[1].length + 1;
    }

    draw(row, column) {

    }
}

export class sqrt extends math_symbol {
    constructor(row, column) { 
        super(row, column, "\\sqrt");
        this.args.push([]);
    }

    displayed_length() {
        return this.args[0].length + 1;
    }


    draw(row, column) { 
        if (row === undefined) {
            row = cursor.x;
        }
        if (column === undefined) {
            column = cursor.y;
        }

        write_text('√');            
        g_ctx.beginPath();
        g_ctx.moveTo(cursor_x_to_pixels(column) + g_ctx.measureText('√').width/2, cursor_y_to_pixels(row) - g_ctx.measureText('√').actualBoundingBoxAscent); // Draw the covering line
        g_ctx.lineTo(cursor_x_to_pixels(column + this.args[0].length) + g_ctx.measureText('√').width/2, cursor_y_to_pixels(row) - g_ctx.measureText('√').actualBoundingBoxAscent);
        g_ctx.closePath();
        g_ctx.stroke();             
        for (var i = 0; i < this.args[0].length; i++) {
            write_text(this.args[0][i], false);
        }
    }
}


export class frac extends math_symbol {
    constructor(row, column) {
        super(row, column, "\\frac");
        this.args.push([], []);
    }

    displayed_length() { return Math.max(this.args[0].length, this.args[1].length); }


    draw(row, column) { 
        if (row === undefined) {
            row = cursor.y;
        }
        if (column === undefined) {
            column = cursor.x;
        }
        var tot_length = this.args[0].length + this.args[1].length;
        var numerator_off = Math.max(0, (tot_length/2) - (this.args[0].length));
        var denom_off = Math.max(0, (this.args[0].length) - (tot_length/2));
        cursor.y-=.5;
        cursor.x += numerator_off;
        g_ctx.beginPath();
        g_ctx.moveTo(cursor_x_to_pixels(column-1), cursor_y_to_pixels(row) - g_ctx.measureText('1').actualBoundingBoxAscent/2); // Draw the covering line
        g_ctx.lineTo(cursor_x_to_pixels(column-.5 + this.displayed_length()), cursor_y_to_pixels(row) - g_ctx.measureText('1').actualBoundingBoxAscent/2);
        g_ctx.closePath();
        g_ctx.stroke();
        for (var i = 0; i < this.args[0].length; i++) {
            write_text(this.args[0][i], false);
        }
        cursor.y++;
        if (this.args.displayed_length !== undefined) {
            cursor.x -= (this.args[0].displayed_length()) + numerator_off;
        }
        else {
            cursor.x -= (this.args[0].length) + numerator_off;
        }
        cursor.x += denom_off;
        for (var i = 0; i < this.args[1].length; i++) {
            write_text(this.args[1][i], false);
        }
        cursor.x++;
        cursor.y-=.5;
    }

    get_cursor_scale(pos, arg) { 
        return new point(1, 0.5);    
    }

    get_cursor_offset(pos, arg) { 
        if (arg === 0) { 
            return new point(0, -0.5);
        }
        else { 
            return new point(0, 0.5);
        }
    }
}

export class subscript extends math_symbol {
    constructor(row, column) {
        super(row, column, "_");
        this.args.push([]);
    }

    displayed_length() {
        return this.args[0].length;
    }

    get_cursor_scale() {
        return new point(1, .5);
    }

    draw() {        
        for (var i = 0; i < this.args[0].length; i++) {
            write_text(this.args[0][i], false);
        }
    }
}


export class pi extends math_symbol {
    constructor(row, column) {
        super(row, column, "\\pi");
    }

    displayed_length() {
        return 1;
    }


    draw() {
        write_text('π', false);
    }
}

export class theta extends math_symbol {
    constructor(row, column) {
        super(row, column, "\\theta");
    }

    displayed_length() {
        return 1;
    }

    draw() {
        write_text('θ', false);
    }
}


const symbol_constructors = {
    "\\sqrt" : sqrt, 
    "\\nrt" : nrt, 
    "\\frac" : frac,
    "_" : subscript,
    "\\pi" : pi, 
    "\\theta" : theta, 
}