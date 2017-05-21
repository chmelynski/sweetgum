
/*

Controls:

Space = edit value
Shift+Space = edit key

Ctrl+Space = edit {} or [] subtree (display a large textarea with underlying text representation)
(we could theoretically map Space to edit subtree, since it's unambiguous.  but big subtrees will basically crash a textarea, so we want people to be careful when choosing to edit a subtree) (TODO)

Up = move cursor up (in display order)
Down = move cursor down (in display order)
Shift+Up = move cursor to prev sibling
Shift+Down = move cursor to next sibling
Ctrl+Up = move cursor to parent
Ctrl+Down = ??
Ctrl+Shift+Up = move cursor to root
Ctrl+Shift+Down = ??

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

Alt+Up = add prev sibling (TODO)
Alt+Down = add next sibling (TODO)
Alt+Left = add parent (TODO)
Alt+Right = add first child (TODO)
Ctrl+Alt+Up = move before prev sibling (and switch array indexes) (TODO)
Ctrl+Alt+Down = move after next sibling (and switch array indexes) (TODO)

Shift+Scroll = 1
Scroll = 10
Ctrl+Scroll = 100
Ctrl+Shift+Scroll = 1000
Ctrl+Shift+Alt+Scroll = 10000
PageUp/PageDown equivalent to Scroll

*/

namespace Sweetgum {

export class Tree {
	
	ctx: CanvasRenderingContext2D;
	data: any;
	
	root: Twig;
	cursor: Twig; // the first visible twig - the cursor and closer are moved simultaneously upon scrolling - that's how we know if we've hit the wall
	closer: Twig; // the last visible twig
	selected: Twig;
	
	twigs: VisibleTwig[]; // caches cx, cy, text
	
	input: HTMLInputElement;
	
	lf: number;
	tp: number;
	indent: number;
	handleRadius: number; // used only to determine if the mouse is hovered over the handle - this requires it to sync with the handle draw function, which is not ideal.  but requiring the user to provide a hit function seems like overkill
	textMargin: number;
	twigHeight: number;
	maxVisible: number;
	font: string;
	drawHandle: (ctx: CanvasRenderingContext2D, tree: Tree, twig: Twig, cx: number, cy: number) => void;
	
	constructor(ctx: CanvasRenderingContext2D, data: any, options: any) {
		
		var tree = this;
		
		this.ctx = ctx;
		this.data = data;
		
		options = options || {};
		this.lf = options.left ? options.left : 50;
		this.tp = options.top ? options.top : 20;
		this.indent = options.indent ? options.indent : 20;
		this.handleRadius = options.handleRadius ? options.handleRadius : 5;
		this.textMargin = options.textMargin ? options.textMargin : 15;
		this.twigHeight = options.twigHeight ? options.twigHeight : 15;
		this.maxVisible = options.maxVisible ? options.maxVisible : Math.floor((ctx.canvas.height - this.tp) / this.twigHeight);
		this.font = options.font ? options.font : '10pt Courier New';
		this.drawHandle = options.drawHandle ? options.drawHandle : DrawHandle;
		
		this.root = Tree.JsonToTwigRec(data);
		this.cursor = this.root;
		this.closer = null;
		this.determineCloser();
		this.selected = this.root;
		
		this.input = document.createElement('input');
		this.input.type = 'text';
		this.input.style.display = 'none';
		this.input.style.position = 'absolute';
		this.ctx.canvas.parentElement.appendChild(this.input);
		
		this.calcVisible();
		this.draw();
		this.setHandlers();
	}
	draw(): void {
		
		const tree = this;
		const ctx = tree.ctx;
		
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.font = tree.font;
		
		for (var i = 0; i < tree.twigs.length; i++)
		{
			const visibleTwig = tree.twigs[i];
			const cx = visibleTwig.cx;
			const cy = visibleTwig.cy;
			tree.drawHandle(ctx, tree, visibleTwig.twig, cx, cy);
			ctx.fillText(visibleTwig.text, cx + tree.textMargin, cy + 0.5);
		}
	}
	determineCursor(): void {
		
		// calculate cursor by walking backward from closer
		// this only happens on selection overflow, so prev === null should never happen
		
		const tree = this;
		let twig = tree.closer;
		
		for (var i = 0; i < tree.maxVisible - 1; i++)
		{
			twig = twig.prev();
			if (twig === null) { throw new Error(); }
		}
		
		tree.cursor = twig;
	}
	determineCloser(): void {
		
		// calculate closer by walking forward from cursor
		
		const tree = this;
		let twig = tree.cursor;
		
		for (var i = 0; i < tree.maxVisible; i++)
		{
			const next = twig.next();
			if (next === null) { break; }
			twig = next;
		}
		
		tree.closer = twig;
	}
	calcVisible(): void {
		
		const tree = this;
		tree.twigs = [];
		
		let twig = tree.cursor;
		
		for (var i = 0; i < tree.maxVisible; i++)
		{
			const cx = tree.lf + twig.indent() * tree.indent;
			const cy = tree.tp + i * tree.twigHeight;
			
			const len = (twig.type == TwigType.Array) ? ((twig == tree.root) ? tree.data.length : twig.obj[twig.key].length.toString()) : 0;
			const val = (twig.type == TwigType.Object) ? '{}' : ((twig.type == TwigType.Array) ? '[' + len + ']' : JSON.stringify(twig.obj[twig.key]));
			const text = twig.key + ' : ' + val;
			
			tree.twigs[i] = new VisibleTwig(twig, cx, cy, text);
			
			if (twig == tree.closer) { break; }
			
			twig = twig.next();
		}
	}
	setHandlers(): void {
		
		const tree = this;
		const ctx = tree.ctx;
		const canvas = ctx.canvas;
		
		let shift = false;
		let ctrl = false;
		let alt = false;
		
		let mx = null;
		let my = null;
		
		let hovered: Twig = null;
		
		function Toggle(twig: Twig, open: boolean): void {
			
			if (twig.type == TwigType.Primitive) { return; }
			
			const toToggle = shift ? (alt ? twig.grandchildren() : twig.children()) : [twig];
			
			for (var i = 0; i < toToggle.length; i++)
			{
				if (ctrl)
				{
					toToggle[i].toggleDescendants(open);
				}
				else
				{
					toToggle[i].open = open;
				}
			}
			
			tree.determineCloser();
			tree.calcVisible();
			tree.draw();
		}
		function CheckOverflow(): void {
			
			// if selected goes below the closer, make the selected the new closer
			let selectedVisible = false;
			
			for (var i = 0; i < tree.twigs.length; i++)
			{
				if (tree.twigs[i].twig == tree.selected)
				{
					selectedVisible = true;
					break;
				}
			}
			
			if (!selectedVisible)
			{
				tree.closer = tree.selected;
				tree.determineCursor();
			}
			
			tree.calcVisible();
			tree.draw();
		}
		function CheckUnderflow(): void {
			
			// if selected goes above the cursor, make the selected the new cursor
			let selectedVisible = false;
			
			for (var i = 0; i < tree.twigs.length; i++)
			{
				if (tree.twigs[i].twig == tree.selected)
				{
					selectedVisible = true;
					break;
				}
			}
			
			if (!selectedVisible)
			{
				tree.cursor = tree.selected;
				tree.determineCloser();
			}
			
			tree.calcVisible();
			tree.draw();
		}
		
		// we can't do anything on focus or blur because we blur the canvas when we move focus to the edit input
		canvas.onfocus = function(e) { };
		canvas.onblur = function(e) { };
		canvas.onmousewheel = function(wheelEvent: MouseWheelEvent) {
			
			wheelEvent.preventDefault();
			wheelEvent.stopPropagation();
			
			const clicks = -wheelEvent.wheelDelta / 120;
			
			// Shift+Scroll = 1, Scroll = 10, Ctrl+Scroll = 100, Ctrl+Shift+Scroll = 1000, Ctrl+Shift+Alt+Scroll = 10000
			const multiplier = (ctrl && shift && alt) ? 10000 : ((ctrl && shift) ? 1000 : (ctrl ? 100 : (shift ? 1 : 10)));
			
			const offset = clicks * multiplier;
			
			tree.scrollBy(offset);
		};
		canvas.onmousemove = function(e) {
			
			mx = e.offsetX;
			my = e.offsetY;
			
			const r = tree.handleRadius;
			
			let hit = false;
			
			for (var i = 0; i < tree.twigs.length; i++)
			{
				const twig = tree.twigs[i];
				
				if (twig.cx - r < mx && mx < twig.cx + r && twig.cy - r < my && my < twig.cy + r)
				{
					hit = true;
					hovered = twig.twig;
					canvas.style.cursor = 'pointer';
					return;
				}
			}
			
			if (!hit && hovered)
			{
				hovered = null;
				canvas.style.cursor = 'default';
			}
		};
		canvas.onmousedown = function(e) {
			
			if (hovered)
			{
				tree.selected = hovered;
				Toggle(hovered, !hovered.open);
			}
		};
		canvas.onkeyup = function(keyUpEvent) {
			
			const key = keyUpEvent.keyCode;
			
			if (key == 16) // shift
			{
				shift = false;
			}
			else if (key == 17) // ctrl
			{
				ctrl = false;
			}
			else if (key == 18) // alt
			{
				alt = false;
			}
		};
		canvas.onkeydown = function(e) {
			
			const key = e.keyCode;
			const letter = e.key;
			
			const selected = tree.selected;
			
			e.preventDefault();
			e.stopPropagation();
			
			if (key == 16)
			{
				shift = true;
			}
			else if (key == 17)
			{
				ctrl = true;
			}
			else if (key == 18)
			{
				alt = true;
			}
			else if (key == 9) // tab
			{
				
			}
			else if (key == 27) // esc
			{
				//tree.selectedIndex = null;
				//tree.selected = null;
			}
			else if (key == 32) // space
			{
				const editVal = !shift;
				
				if (!editVal && tree.selected == tree.root) { return; } // can't edit the key of the root
				
				let index = -1;
				for (var i = 0; i < tree.twigs.length; i++)
				{
					if (tree.twigs[i].twig == tree.selected)
					{
						index = i;
						break;
					}
				}
				if (index < 0) { return; }
				const visibleTwig = tree.twigs[index];
				
				const lf = ctx.canvas.offsetLeft + visibleTwig.cx + tree.textMargin;
				const tp = ctx.canvas.offsetTop + visibleTwig.cy - 10;
				
				const input = tree.input;
				input.style.display = 'block';
				input.style.left = lf + 'px';
				input.style.top = tp + 'px';
				
				if (editVal)
				{
					input.value = (tree.selected == tree.root) ? JSON.stringify(tree.data) : JSON.stringify(tree.selected.obj[tree.selected.key]);
				}
				else
				{
					input.value = tree.selected.key;
				}
				
				input.focus();
				
				input.onkeydown = function(e) {
					
					const key = e.keyCode;
					
					if (key == 27) // Esc = reject edit
					{
						input.style.display = 'none';
						input.value = '';
						ctx.canvas.focus();
						
						e.preventDefault();
						e.stopPropagation();
					}
					else if (key == 13) // Enter = accept edit
					{
						input.style.display = 'none';
						
						const text = input.value;
						const twig = tree.selected;
						
						if (editVal)
						{
							twig.obj[twig.key] = JSON.parse(text);
						}
						else
						{
							if (text != twig.key && !twig.obj[text]) // text != twig.key is actually redundant here, but that's okay
							{
								const val = twig.obj[twig.key]
								delete twig.obj[twig.key];
								twig.obj[text] = val;
								twig.key = text;
							}
						}
						
						ctx.canvas.focus();
						
						e.preventDefault();
						e.stopPropagation();
						
						tree.calcVisible();
						tree.draw();
					}
				};
			}
			else if (key == 33 || key == 34) // page up/down
			{
				const offset = (ctrl && shift && alt) ? 10000 : ((ctrl && shift) ? 1000 : (ctrl ? 100 : (shift ? 1 : 10)));
				const direction = ((key == 33) ? -1 : 1);
				tree.scrollBy(direction * offset);
			}
			else if (key == 37 || key == 39) // left or right
			{
				const open = (key == 39); // right = open
				
				if (!shift && !alt && !ctrl && !open && (!selected.open || selected.type == TwigType.Primitive))
				{
					if (tree.selected.parent !== null)
					{
						tree.selected = tree.selected.parent;
						CheckUnderflow();
					}
				}
				else if (!shift && !alt && !ctrl && open && selected.open)
				{
					const next = tree.selected.next();
					if (next !== null) { tree.selected = next; CheckOverflow(); }
				}
				else
				{
					Toggle(selected, open);
				}
			}
			else if (key == 38 || key == 40) // up or down
			{
				// Up = move cursor up (in display order)
				// Down = move cursor down (in display order)
				// Shift+Up = move cursor to prev sibling 
				// Shift+Down = move cursor to next sibling
				// Ctrl+Up = move cursor to parent
				// Ctrl+Down = ?? (TODO)
				// Ctrl+Shift+Up = move cursor to root
				// Ctrl+Shift+Down = move cursor to bookmark? (TODO)
				// Alt+Up = add prev sibling (TODO)
				// Alt+Down = add next sibling (TODO)
				
				if (key == 38) // up
				{
					if (ctrl && shift)
					{
						tree.selected = tree.root;
					}
					else if (ctrl)
					{
						if (tree.selected.parent !== null) { tree.selected = tree.selected.parent; }
					}
					else if (shift)
					{
						if (tree.selected.prevSibling) { tree.selected = tree.selected.prevSibling; }
					}
					else if (alt)
					{
						
					}
					else
					{
						const prev = tree.selected.prev();
						if (prev !== null) { tree.selected = prev; }
					}
					
					CheckUnderflow();
				}
				else if (key == 40) // down
				{
					if (ctrl && shift)
					{
						// to bookmark?
					}
					else if (ctrl)
					{
						// ??
					}
					else if (shift)
					{
						if (tree.selected.nextSibling) { tree.selected = tree.selected.nextSibling; }
					}
					else if (alt)
					{
						
					}
					else
					{
						const next = tree.selected.next();
						if (next !== null) { tree.selected = next; }
					}
					
					CheckOverflow();
				}
			}
		};
	}
	scrollBy(offset: number): void {
		
		const tree = this;
		
		let cursor = tree.cursor;
		let closer = tree.closer;
		
		let n = offset;
		
		if (n > 0)
		{
			while (n > 0)
			{
				const nextCursor = cursor.next();
				const nextCloser = closer.next();
				if (nextCloser === null) { break; }
				cursor = nextCursor;
				closer = nextCloser;
				n--;
			}
		}
		else
		{
			while (n < 0)
			{
				const prevCursor = cursor.prev();
				const prevCloser = closer.prev();
				if (prevCursor === null) { break; }
				cursor = prevCursor;
				closer = prevCloser;
				n++;
			}
		}
		
		tree.cursor = cursor;
		tree.closer = closer;
		tree.calcVisible();
		tree.draw();
	}
	static JsonToTwigRec(json: any, key?: string): Twig {
		
		if (key === undefined) { key = '[root]'; }
		
		const type = Object.prototype.toString.apply(json);
		const twig = new Twig();
		twig.key = key;
		
		if (type == '[object Object]')
		{
			twig.type = TwigType.Object;
			
			let first = true;
			let prevChild = null;
			
			for (var key in json)
			{
				const child = Tree.JsonToTwigRec(json[key], key);
				child.obj = json;
				child.parent = twig;
				
				if (first)
				{
					twig.firstChild = child;
				}
				else
				{
					prevChild.nextSibling = child;
					child.prevSibling = prevChild;
				}
				
				first = false;
				prevChild = child;
			}
			
			twig.lastChild = prevChild;
		}
		else if (type == '[object Array]')
		{
			twig.type = TwigType.Array;
			
			let first = true;
			let prevChild = null;
			
			for (var i = 0; i < json.length; i++)
			{
				const child = Tree.JsonToTwigRec(json[i], i.toString());
				child.obj = json;
				child.parent = twig;
				
				if (first)
				{
					twig.firstChild = child;
				}
				else
				{
					prevChild.nextSibling = child;
					child.prevSibling = prevChild;
				}
				
				first = false;
				prevChild = child;
			}
			
			twig.lastChild = prevChild;
		}
		else
		{
			twig.type = TwigType.Primitive;
		}
		
		return twig;
	}
}
class Twig {
	
	open: boolean; // {} or [] only
	
	type: TwigType;
	
	obj: any; // null if root, otherwise references the parent {} or [] of the json
	key: string;
	
	parent: Twig; // null if root
	firstChild: Twig;
	lastChild: Twig;
	nextSibling: Twig;
	prevSibling: Twig;
	
	constructor() {
		
		this.type = TwigType.Primitive;
		
		this.parent = null;
		this.firstChild = null;
		this.lastChild = null;
		this.nextSibling = null;
		this.prevSibling = null;
		
		this.open = true;
		
		this.obj = null;
		this.key = null;
	}
	descendants(): Twig[] {
		
		const l = [];
		
		function DescendantsRec(twig: Twig): void {
			
			l.push(twig);
			
			const children = twig.children();
			
			for (var i = 0; i < children.length; i++)
			{
				DescendantsRec(children[i]);
			}
		}
		
		DescendantsRec(this);
		
		return l;
	}
	indent(): number {
		
		const twig = this;
		
		if (twig.parent)
		{
			return twig.parent.indent() + 1; 
		}
		else
		{
			return 0;
		}
	}
	prev(): Twig {
		
		const twig = this;
		
		function Last(t) {
			
			if (t.open && t.lastChild !== null)
			{
				return Last(t.lastChild);
			}
			else
			{
				return t;
			}
		}
		
		if (twig.parent === null)
		{
			return null;
		}
		else if (twig == twig.parent.firstChild)
		{
			return twig.parent;
		}
		else
		{
			return Last(twig.prevSibling);
		}
	}
	next(): Twig {
		
		const twig = this;
		
		function NextHelper(t) {
			
			if (t.nextSibling)
			{
				return t.nextSibling;
			}
			else
			{
				if (t.parent)
				{
					return NextHelper(t.parent);
				}
				else
				{
					return null;
				}
			}
		}
		
		if (twig.type == TwigType.Object || twig.type == TwigType.Array)
		{
			if (twig.open && twig.firstChild)
			{
				return twig.firstChild;
			}
			else
			{
				return NextHelper(twig);
			}
		}
		else
		{
			return NextHelper(twig);
		}
	}
	toggleDescendants(open: boolean): void {
		
		const twig = this;
		
		twig.open = open;
		
		const children = twig.children();
		
		for (var i = 0; i < children.length; i++)
		{
			children[i].toggleDescendants(open);
		}
	}
	children(): Twig[] {
		
		const twig = this;
		
		const children = [];
		
		if (twig.firstChild === null) { return children; }
		
		let child = twig.firstChild;
		
		children.push(child);
		
		while (child.nextSibling !== null)
		{
			child = child.nextSibling;
			children.push(child);
		}
		
		return children;
	}
	grandchildren(): Twig[] {
		
		const twig = this;
		
		const children = twig.children();
		
		let grandchildren = [];
		
		for (var i = 0; i < children.length; i++)
		{
			grandchildren = grandchildren.concat(children[i].children());
		}
		
		return grandchildren;
	}
}
class VisibleTwig {
	
	twig: Twig;
	cx: number;
	cy: number;
	text: string;
	
	constructor(twig: Twig, cx: number, cy: number, text: string) {
		
		this.twig = twig;
		this.cx = cx;
		this.cy = cy;
		this.text = text;
	}
}
function DrawHandle(ctx: CanvasRenderingContext2D, tree: Tree, twig: Twig, cx: number, cy: number): void {
	
	const handleRadius = 5;
	
	// selected dots
	if (twig == tree.selected)
	{
		const lf = cx - handleRadius - 2;
		const tp = cy - handleRadius - 2;
		const wd = handleRadius * 2 + 5;
		
		ctx.setLineDash([1,1]);
		ctx.beginPath();
		ctx.moveTo(lf, tp+0.5);
		ctx.lineTo(lf+wd, tp+0.5);
		ctx.moveTo(lf+wd-0.5, tp);
		ctx.lineTo(lf+wd-0.5, tp+wd);
		ctx.moveTo(lf+wd, tp+wd-0.5);
		ctx.lineTo(lf, tp+wd-0.5);
		ctx.moveTo(lf+0.5, tp+wd);
		ctx.lineTo(lf+0.5, tp);
		ctx.stroke();
		ctx.setLineDash([1,0]);
	}
	
	// box
	ctx.strokeRect(cx - handleRadius + 0.5, cy - handleRadius + 0.5, handleRadius * 2, handleRadius * 2);
	
	// +/-
	if (twig.firstChild !== null)
	{
		ctx.beginPath();
		ctx.moveTo(cx - 1, cy+0.5);
		ctx.lineTo(cx + 3, cy+0.5);
		ctx.stroke();
		
		if (!twig.open)
		{
			ctx.beginPath();
			ctx.moveTo(cx+0.5, cy - 2);
			ctx.lineTo(cx+0.5, cy + 2);
			ctx.stroke();
		}
	}
}
const enum TwigType { Object, Array, Primitive }

}

