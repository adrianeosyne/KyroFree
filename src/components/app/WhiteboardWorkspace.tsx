import { useRef, useState, type PointerEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useBotTask } from "./BotPlatformShared";
import { EmptyState, LoadingRows, ConfirmDelete } from "./AdvancedShared";
import type { CollaborationScope } from "./TaskBoard";
type Shape = FunctionReturnType<typeof api.whiteboards.objects>["page"][number];
type Point = { x: number; y: number };
type Geometry = Pick<
  Shape,
  "kind" | "x" | "y" | "width" | "height" | "text" | "color" | "points"
>;
export function WhiteboardWorkspace({
  scope,
  members,
}: {
  scope: CollaborationScope;
  members: { id: string; name: string }[];
}) {
  const boards = useQuery(api.whiteboards.list, scope),
    create = useMutation(api.whiteboards.create),
    remove = useMutation(api.whiteboards.remove),
    task = useBotTask();
  const [title, setTitle] = useState(""),
    [selected, setSelected] = useState<Id<"whiteboards"> | null>(null);
  if (selected)
    return (
      <Whiteboard
        key={selected}
        boardId={selected}
        members={members}
        onBack={() => setSelected(null)}
      />
    );
  return (
    <section className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            const id = await create({ ...scope, title });
            setTitle("");
            setSelected(id);
          }, "Whiteboard created");
        }}
      >
        <Input
          aria-label="Whiteboard title"
          placeholder="New whiteboard title"
          maxLength={120}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" disabled={task.busy || !title.trim()}>
          Create whiteboard
        </Button>
      </form>
      {!boards ? (
        <LoadingRows />
      ) : !boards.length ? (
        <EmptyState>No whiteboards in this conversation yet.</EmptyState>
      ) : (
        boards.map((board) => (
          <article
            key={board._id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
          >
            <div>
              <h2 className="font-semibold">{board.title}</h2>
              <p className="text-xs text-muted-foreground">
                Updated {new Date(board.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelected(board._id)}
              >
                Open whiteboard
              </Button>
              {board.mine && (
                <ConfirmDelete
                  title="Delete whiteboard?"
                  description="This removes the whiteboard and all its drawings."
                  onConfirm={() =>
                    remove({
                      boardId: board._id,
                      expectedRevision: board.revision,
                    })
                  }
                />
              )}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
function Whiteboard({
  boardId,
  members,
  onBack,
}: {
  boardId: Id<"whiteboards">;
  members: { id: string; name: string }[];
  onBack: () => void;
}) {
  const info = useQuery(api.whiteboards.info, { boardId }),
    objects = usePaginatedQuery(
      api.whiteboards.objects,
      { boardId },
      { initialNumItems: 100 },
    );
  const save = useMutation(api.whiteboards.saveObject),
    remove = useMutation(api.whiteboards.removeObject),
    setEditors = useMutation(api.whiteboards.setEditors),
    task = useBotTask();
  const [tool, setTool] = useState("select"),
    [color, setColor] = useState("#2563eb"),
    [note, setNote] = useState(""),
    [draft, setDraft] = useState<Geometry | null>(null),
    [selected, setSelected] = useState<Shape | null>(null);
  const svg = useRef<SVGSVGElement>(null),
    gesture = useRef<{
      start: Point;
      shape: Geometry;
      pointerId: number;
    } | null>(null);
  const position = (event: PointerEvent<SVGSVGElement>): Point => {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: Math.round(
        Math.max(
          0,
          Math.min(1000, ((event.clientX - rect.left) / rect.width) * 1000),
        ),
      ),
      y: Math.round(
        Math.max(
          0,
          Math.min(1000, ((event.clientY - rect.top) / rect.height) * 1000),
        ),
      ),
    };
  };
  const store = (shape: Geometry) =>
    void task.run(() =>
      save({
        ...shape,
        boardId,
        key: crypto.randomUUID(),
        expectedRevision: 0,
      }),
    );
  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (tool === "select") {
      if (event.target === svg.current) setSelected(null);
      return;
    }
    if (!info?.canEdit || task.busy || event.button !== 0) return;
    const start = position(event);
    svg.current!.setPointerCapture(event.pointerId);
    const shape: Geometry = {
      kind: tool === "draw" ? "stroke" : tool === "note" ? "note" : "rectangle",
      x: tool === "draw" ? 0 : start.x,
      y: tool === "draw" ? 0 : start.y,
      width: 0,
      height: 0,
      text: tool === "note" ? note : "",
      color,
      points: tool === "draw" ? [start] : [],
    };
    gesture.current = { start, shape, pointerId: event.pointerId };
    setDraft(shape);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = position(event);
    let shape = current.shape;
    if (shape.kind === "stroke") {
      const points =
        shape.points.length >= 300
          ? shape.points.filter((_, i) => i % 2 === 0)
          : shape.points;
      shape = { ...shape, points: [...points, point] };
    } else
      shape = {
        ...shape,
        x: Math.min(point.x, current.start.x),
        y: Math.min(point.y, current.start.y),
        width: Math.abs(point.x - current.start.x),
        height: Math.abs(point.y - current.start.y),
      };
    current.shape = shape;
    setDraft(shape);
  };
  const up = (event: PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDraft(null);
    if (svg.current?.hasPointerCapture(event.pointerId))
      svg.current.releasePointerCapture(event.pointerId);
    const shape = current.shape;
    if (shape.kind === "stroke" && shape.points.length < 2) return;
    if (shape.kind === "note" && !shape.text.trim()) return;
    store(
      shape.kind === "note"
        ? {
            ...shape,
            width: Math.max(180, shape.width),
            height: Math.max(100, shape.height),
          }
        : shape,
    );
  };
  const cancel = () => {
    gesture.current = null;
    setDraft(null);
  };
  const download = () => {
    if (!svg.current) return;
    const clone = svg.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], {
        type: "image/svg+xml",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kyro-whiteboard.svg";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const latest =
      selected && objects.results.find((o) => o._id === selected._id),
    conflict = !!selected && (!latest || latest.revision !== selected.revision);
  const render = (shape: Geometry) =>
    shape.kind === "stroke" ? (
      <polyline
        points={shape.points.map((p) => `${p.x},${p.y}`).join(" ")}
        transform={`translate(${shape.x},${shape.y})`}
        fill="none"
        stroke={shape.color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : shape.kind === "rectangle" ? (
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        fill="transparent"
        stroke={shape.color}
        strokeWidth="4"
      />
    ) : (
      <g>
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.width || 180}
          height={shape.height || 100}
          fill="#fff7cc"
          stroke={shape.color}
          strokeWidth="2"
        />
        <text x={shape.x + 10} y={shape.y + 25} fill="#111827" fontSize="18">
          {shape.text
            .split("\n")
            .slice(0, 12)
            .map((line, i) => (
              <tspan key={i} x={shape.x + 10} dy={i ? 24 : 0}>
                {line.slice(0, 80)}
              </tspan>
            ))}
        </text>
      </g>
    );
  return (
    <section className="space-y-3">
      <Button size="sm" variant="outline" onClick={onBack}>
        Back to whiteboards
      </Button>
      <h2 className="text-lg font-semibold">{info?.title ?? "Whiteboard"}</h2>
      <p className="text-xs text-muted-foreground">
        Drawings appear for participants after each stroke. Last updated by{" "}
        {info?.updatedByName ?? "a member"}.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Label>
          Whiteboard tool
          <select
            aria-label="Whiteboard tool"
            className="ml-2 h-9 rounded-md border bg-background px-2"
            disabled={!info?.canEdit}
            value={tool}
            onChange={(e) => setTool(e.target.value)}
          >
            <option value="select">Select</option>
            <option value="draw">Draw</option>
            <option value="rectangle">Rectangle</option>
            <option value="note">Note</option>
          </select>
        </Label>
        <input
          type="color"
          aria-label="Drawing color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!info?.canEdit || task.busy}
          onClick={() =>
            store({
              kind: "rectangle",
              x: 100,
              y: 100,
              width: 220,
              height: 140,
              color,
              text: "",
              points: [],
            })
          }
        >
          Add rectangle
        </Button>
        <Button size="sm" variant="outline" onClick={download}>
          Download whiteboard SVG
        </Button>
      </div>
      {info?.canEdit && (
        <div className="flex gap-2">
          <Textarea
            aria-label="New whiteboard note"
            placeholder="Write a note, then place it on the board"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            disabled={task.busy || !note.trim()}
            onClick={() =>
              store({
                kind: "note",
                x: 100,
                y: 100,
                width: 260,
                height: 180,
                color,
                text: note,
                points: [],
              })
            }
          >
            Add note
          </Button>
        </div>
      )}
      <svg
        ref={svg}
        role="img"
        aria-label={`${info?.title ?? "Shared"} whiteboard canvas`}
        viewBox="0 0 1000 1000"
        className="mx-auto aspect-square w-full max-w-[45dvh] rounded-xl border bg-white"
        style={{
          touchAction: "none",
          cursor: tool === "select" ? "default" : "crosshair",
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
      >
        <title>{info?.title ?? "Shared whiteboard"}</title>
        {[...objects.results].reverse().map((shape) => (
          <g
            key={shape._id}
            onPointerDown={(e) => {
              if (tool === "select") {
                e.stopPropagation();
                setSelected(shape);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Select ${shape.kind}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(shape);
              }
            }}
          >
            {render(shape)}
          </g>
        ))}
        {draft && render(draft)}
      </svg>
      {objects.status === "CanLoadMore" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => objects.loadMore(100)}
        >
          Load older drawings
        </Button>
      )}
      {selected && (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-semibold">Selected {selected.kind}</p>
          {conflict && (
            <p role="alert" className="text-sm text-destructive">
              This object changed. Select it again to review the latest drawing.
            </p>
          )}
          {selected.kind === "note" && (
            <Textarea
              aria-label="Selected whiteboard note"
              disabled={!info?.canEdit}
              maxLength={1000}
              value={selected.text}
              onChange={(e) =>
                setSelected({ ...selected, text: e.target.value })
              }
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!info?.canEdit || task.busy || conflict}
              onClick={() =>
                void task.run(async () => {
                  const { kind, x, y, width, height, text, points } = selected;
                  await save({
                    boardId,
                    key: selected.key,
                    kind,
                    x,
                    y,
                    width,
                    height,
                    text,
                    points,
                    color,
                    expectedRevision: selected.revision,
                  });
                  setSelected(null);
                })
              }
            >
              Save selected object
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!info?.canEdit || task.busy || conflict}
              onClick={() =>
                void task.run(async () => {
                  await remove({
                    objectId: selected._id,
                    expectedRevision: selected.revision,
                  });
                  setSelected(null);
                })
              }
            >
              Delete selected object
            </Button>
          </div>
        </div>
      )}
      {info?.mine && (
        <section className="space-y-2 border-t pt-3">
          <h3 className="font-semibold">Whiteboard editors</h3>
          <Label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={info.editors === undefined}
              disabled={task.busy}
              onChange={(e) =>
                void task.run(() =>
                  setEditors({
                    boardId,
                    editors: e.target.checked ? null : [],
                    expectedRevision: info.revision,
                  }),
                )
              }
            />
            Everyone in this conversation can edit
          </Label>
          {info.editors !== undefined &&
            members
              .filter((m) => m.id !== info.userId)
              .map((member) => (
                <Label key={member.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={info.editors!.includes(member.id as Id<"users">)}
                    disabled={task.busy}
                    onChange={(e) =>
                      void task.run(() =>
                        setEditors({
                          boardId,
                          editors: e.target.checked
                            ? [...info.editors!, member.id as Id<"users">]
                            : info.editors!.filter((id) => id !== member.id),
                          expectedRevision: info.revision,
                        }),
                      )
                    }
                  />
                  {member.name}
                </Label>
              ))}
        </section>
      )}
    </section>
  );
}
