# Sweetgum

A tree viewer for JSON data

## Usage

    var ctx = document.getElementById('canvas').getContext('2d');
    ctx.canvas.focus();
    
    var data = {a:'foo',b:[{a:'foo'},'baz'],c:['bar','baz']};
    
    var options = {
    	top: 20,
    	left: 50,
    	indent: 20,
    	handleRadius: 5,
    	textMargin: 15,
    	twigHeight: 15,
    	maxVisible: 30,
    	font: '10pt Courier New',
    	drawHandle: null
    };
    
    var tree = new Sweetgum.Tree(ctx, data, options);

## Controls

    Space = edit value
    Shift+Space = edit key
    
    Up = move cursor up (in display order)
    Down = move cursor down (in display order)
    Shift+Up = move cursor to prev sibling
    Shift+Down = move cursor to next sibling
    Ctrl+Up = move cursor to parent
    Ctrl+Shift+Up = move cursor to root
    
    Right = open, or move cursor to next
    Left = close, or move cursor to parent
    Ctrl+Right = open descendants
    Ctrl+Left = close descendants
    Shift+Right = open children
    Shift+Left = close children
    Ctrl+Shift+Right = open children and descendants
    Ctrl+Shift+Left = close children and descendants
    Shift+Alt+Right = open grandchildren
    Shift+Alt+Left = close grandchildren
    Ctrl+Shift+Alt+Right = open grandchildren and descendants
    Ctrl+Shift+Alt+Left = close grandchildren and descendants
    
    Shift+Scroll = scroll by 1
    Scroll = 10
    Ctrl+Scroll = 100
    Ctrl+Shift+Scroll = 1000
    Ctrl+Shift+Alt+Scroll = 10000
    PageUp/PageDown equivalent to Scroll
