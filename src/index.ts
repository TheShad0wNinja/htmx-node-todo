import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { QuickDB } from "quick.db";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";

const db = new QuickDB();
const app = express();
const port = 6969;

type Todo = {
    id: string;
    text: string;
    completed: boolean;
};

app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

app.get("/", async (req: Request, res: Response) => {
    const cookies = req.cookies;

    if (!cookies.id) {
        const newId = randomUUID();
        console.log("NEW USER FOUND ASSIGNING ID ", newId);
        await db.set<Todo[]>(newId, []);
        res.cookie("id", randomUUID(), {
            expires: new Date(
                new Date().getTime() + 1000 * 60 * 60 * 24 * 365 * 10
            ),
        });
    }

    res.send(BaseHtml());
});

app.get("/todos", async (req: Request, res: Response) => {
    const cookies = req.cookies;
    if (!cookies.id) return res.send();

    const todos = (await db.get(cookies.id)) as Todo[];

    res.send(TodoList(todos));
});

app.post("/todos", async (req: Request, res: Response) => {
    console.log(req.body);

    if (!req.body.todo?.trim() || !req.cookies.id || req.body.todo === "")
        res.send();

    const newTodo = {
        id: randomUUID(),
        text: req.body.todo,
        completed: false,
    } as Todo;
    db.push(req.cookies.id, newTodo);
    res.send(NewTodo(newTodo));
});

app.post("/remove/:id", async (req: Request, res: Response) => {
    if (!req.params.id || !req.cookies.id) return;

    const oldTodos = (await db.get(req.cookies.id)) as Todo[];

    await db.set(
        req.cookies.id,
        oldTodos.filter((t) => t.id !== req.params.id)
    );

    res.send();
});

app.post("/complete/:id", async (req: Request, res: Response) => {
    if (!req.params.id || !req.cookies.id) return;

    const oldTodo = ((await db.get(req.cookies.id)) as Todo[]).filter(
        (t) => t.id === req.params.id
    )[0];

    if (!oldTodo) return;

    const oldTodos = (await db.get(req.cookies.id)) as Todo[];

    await db.set(
        req.cookies.id,
        oldTodos.filter((t) => t.id !== req.params.id)
    );

    oldTodo.completed = !oldTodo.completed;

    await db.push(req.cookies.id, oldTodo);

    res.send();
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

const TodoList = (todos: Todo[]) => {
    if (!todos) return "";
    return todos.map((todo) => NewTodo(todo)).join("");
};

const NewTodo = (todo: Todo) => {
    return `
	<div class="row">
		<div style="display: flex; justify-content: space-between">
			<h5>${todo.text}</h5>
			<input 
				type="checkbox"  
				name="completed" 
				${todo.completed ? "checked" : ""}
				hx-post="/complete/${todo.id}" 
				hx-swap="none"
			/>
		</div>
		<button 
			class="secondary"
			hx-post="/remove/${todo.id}"
			hx-swap="outerHTML"
			hx-target="closest .row"
		>
			Delete
		</button>	
	</div>
	`;
};

const AddTodo = () => {
    return `
		<form hx-post="/todos" hx-target="#todos" hx-swap="beforeend">
			<input name='todo' type="text" placeholder="New todo" required/>
		</form>
	`;
};

const BaseHtml = () => `
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="css/pico.min.css" />
        <script defer="true" src="htmx.min.js"></script>
        <title>Todo</title>
    </head>

	<body>
		<main class="container">
			<h1>Todo</h1>
			${AddTodo()}
			<div
				hx-get="/todos"
				hx-trigger="load"
				hx-swap="innerHTML"
				hx-target="this"
				id="todos"
			></div>
		</main>
	</body>
`;
