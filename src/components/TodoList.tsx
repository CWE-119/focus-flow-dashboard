import React, { forwardRef, useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Plus, X, Repeat, Flag, Settings2, Tag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import TodoForm, { TodoFormData } from "./TodoForm";
import GradientText from "@/components/ui/gradient-text";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api";
import { useCategories, Category } from "@/hooks/use-categories";
import CategoryManager from "./CategoryManager";

interface Todo {
  _id?: string;
  id?: number;
  title?: string;
  text?: string;
  completed: boolean;
  repeatType?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  repeatInterval?: number;
  repeatDays?: number[];
  repeatLimit?: number | null;
  repeatCount?: number;
  repeatEndDate?: string | null;
  priority?: "low" | "medium" | "high";
  dueDate?: string | null;
}

interface AnimatedTodoProps {
  todo: Todo;
  category?: Category;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}

const priorityColors = {
  low: "text-muted-foreground",
  medium: "text-yellow-500",
  high: "text-red-500",
};

const activityGradientColors = ["#5ca8e0", "#9b7ed9", "#d96aa3", "#e09746"];
const TODO_ROW_HEIGHT = 40;
const TODO_LIST_HEIGHT = 240;
const TODO_OVERSCAN = 6;

const CategoryPill = ({ category }: { category: Category }) => (
  <span
    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-body font-medium shrink-0 border"
    style={{
      color: category.color,
      backgroundColor: `${category.color}15`,
      borderColor: `${category.color}40`,
    }}
    title={category.name}
  >
    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} />
    {category.name}
  </span>
);

const AnimatedTodo = forwardRef<HTMLDivElement, AnimatedTodoProps>(({ todo, category, onToggle, onEdit, onDelete, index }, ref) => {
  const hasRepeat = todo.repeatType && todo.repeatType !== "none";
  const title = todo.title || todo.text || "";

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, x: -100 }}
      transition={{
        duration: 0.25,
        delay: index * 0.05,
        layout: { duration: 0.2 },
      }}
      className="flex items-center gap-3 group py-1"
    >
      <Checkbox
        checked={todo.completed}
        onCheckedChange={onToggle}
        className="border-foreground data-[state=checked]:bg-foreground"
      />
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {todo.priority && todo.priority !== "medium" && (
          <Flag className={cn("w-3 h-3 shrink-0", priorityColors[todo.priority])} />
        )}
        {hasRepeat ? (
          <GradientText
            colors={activityGradientColors}
            animationSpeed={4}
            animateOnHover={true}
            className={cn("font-body text-sm truncate", todo.completed && "opacity-50")}
          >
            <span className={todo.completed ? "line-through" : ""}>{title}</span>
          </GradientText>
        ) : (
          <motion.span
            animate={{ opacity: todo.completed ? 0.5 : 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "font-body text-sm truncate",
              todo.completed ? "line-through text-muted-foreground" : "text-foreground"
            )}
          >
            {title}
          </motion.span>
        )}
        {hasRepeat && <Repeat className="w-3 h-3 text-muted-foreground shrink-0" />}
        {category && <CategoryPill category={category} />}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity shrink-0"
        title="Edit task"
      >
        <Edit2 className="w-3 h-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity shrink-0"
      >
        <X className="w-3 h-3" />
      </Button>
    </motion.div>
  );
});
AnimatedTodo.displayName = "AnimatedTodo";

const TodoList = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [quickTodo, setQuickTodo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string | "all">("all");
  const [managerOpen, setManagerOpen] = useState(false);

  const { categories, getTaskCategory, setTaskCategory, taskMap } = useCategories();

  const getTodoId = (todo: Todo) => todo._id || String(todo.id) || "";

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const parseRepeatDays = (value?: number[] | string | null) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const toFormData = (todo: Todo): Partial<TodoFormData> => ({
    title: todo.title || todo.text || "",
    repeatType: todo.repeatType || "none",
    repeatInterval: todo.repeatInterval || 1,
    repeatDays: parseRepeatDays(todo.repeatDays as number[] | string | null),
    repeatLimit: todo.repeatLimit ?? null,
    repeatEndDate: parseDate(todo.repeatEndDate),
    priority: todo.priority || "medium",
    dueDate: parseDate(todo.dueDate),
    categoryId: taskMap[getTodoId(todo)] ?? null,
  });

  const filteredTodos = useMemo(() => {
    if (activeFilter === "all") return todos;
    return todos.filter((t) => taskMap[getTodoId(t)] === activeFilter);
  }, [todos, activeFilter, taskMap]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todos.forEach((t) => {
      const cid = taskMap[getTodoId(t)];
      if (cid) counts[cid] = (counts[cid] || 0) + 1;
    });
    return counts;
  }, [todos, taskMap]);

  const visibleTodos = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / TODO_ROW_HEIGHT) - TODO_OVERSCAN);
    const count = Math.ceil(TODO_LIST_HEIGHT / TODO_ROW_HEIGHT) + TODO_OVERSCAN * 2;
    return {
      start,
      items: filteredTodos.slice(start, start + count),
      before: start * TODO_ROW_HEIGHT,
      after: Math.max(0, (filteredTodos.length - start - count) * TODO_ROW_HEIGHT),
    };
  }, [filteredTodos, scrollTop]);

  const fetchTodos = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/todos`);
      if (!res.ok) throw new Error(`Failed to fetch todos: ${res.statusText}`);
      const data = await res.json();
      setTodos(data);
    } catch (error) {
      console.error("Error fetching todos:", error);
    }
  };

  const addQuickTodo = async () => {
    if (quickTodo.trim()) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: quickTodo.trim() }),
        });
        if (res.ok) {
          const created = await res.json();
          // If a filter is active, auto-assign that category
          if (activeFilter !== "all" && created) {
            const id = created._id || String(created.id) || "";
            if (id) setTaskCategory(id, activeFilter);
          }
          await fetchTodos();
          setQuickTodo("");
        }
      } catch (error) {
        console.error("Error adding todo:", error);
      }
    }
  };

  const addTodoWithOptions = async (data: TodoFormData) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          repeatType: data.repeatType,
          repeatInterval: data.repeatInterval,
          repeatDays: data.repeatDays,
          repeatLimit: data.repeatLimit,
          repeatEndDate: data.repeatEndDate?.toISOString() || null,
          priority: data.priority,
          dueDate: data.dueDate?.toISOString() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        if (created) {
          const id = created._id || String(created.id) || "";
          if (id) setTaskCategory(id, data.categoryId ?? null);
        }
        await fetchTodos();
      }
    } catch (error) {
      console.error("Error adding todo:", error);
    }
  };

  const updateTodoWithOptions = async (data: TodoFormData) => {
    if (!editingTodo) return;
    const id = getTodoId(editingTodo);
    if (!id) return;

    try {
      const res = await fetch(`${getApiBaseUrl()}/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          repeatType: data.repeatType,
          repeatInterval: data.repeatInterval,
          repeatDays: data.repeatDays,
          repeatLimit: data.repeatLimit,
          repeatEndDate: data.repeatEndDate?.toISOString() || null,
          priority: data.priority,
          dueDate: data.dueDate?.toISOString() || null,
        }),
      });
      if (res.ok) {
        setTaskCategory(id, data.categoryId ?? null);
        await fetchTodos();
        setEditingTodo(null);
      }
    } catch (error) {
      console.error("Error updating todo:", error);
    }
  };

  const toggleTodo = async (id: string) => {
    const todo = todos.find((t) => t._id === id || String(t.id) === id);
    if (!todo) return;
    try {
      await fetch(`${getApiBaseUrl()}/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      await fetchTodos();
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  const deleteTodo = async (id: string) => {
    await fetch(`${getApiBaseUrl()}/todos/${id}`, { method: "DELETE" });
    setTaskCategory(id, null);
    await fetchTodos();
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div className="border border-border rounded-md p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
          Today's Tasks
        </span>
        <div className="flex items-center gap-2">
          <span className="font-body text-xs text-muted-foreground tabular-nums">
            {completedCount}/{todos.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setManagerOpen(true)}
            title="Manage categories"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button
          onClick={() => setActiveFilter("all")}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-body font-medium border transition-colors",
            activeFilter === "all"
              ? "bg-foreground text-background border-foreground"
              : "bg-transparent text-muted-foreground border-border hover:border-foreground/40"
          )}
        >
          All · {todos.length}
        </button>
        {categories.map((c) => {
          const active = activeFilter === c.id;
          const count = categoryCounts[c.id] || 0;
          return (
            <button
              key={c.id}
              onClick={() => setActiveFilter(c.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-body font-medium border transition-all inline-flex items-center gap-1.5"
              )}
              style={{
                color: active ? "#fff" : c.color,
                backgroundColor: active ? c.color : `${c.color}15`,
                borderColor: active ? c.color : `${c.color}40`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: active ? "#fff" : c.color }}
              />
              {c.name} · {count}
            </button>
          );
        })}
        {categories.length === 0 && (
          <button
            onClick={() => setManagerOpen(true)}
            className="px-2.5 py-1 rounded-full text-[11px] font-body font-medium border border-dashed border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Tag className="w-3 h-3" />
            Add a category
          </button>
        )}
      </div>

      <div
        className="mb-5 max-h-[240px] overflow-y-auto"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <AnimatePresence mode="popLayout">
          {filteredTodos.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-body text-sm text-muted-foreground text-center py-6"
            >
              {activeFilter === "all" ? "No tasks yet" : "No tasks in this category"}
            </motion.p>
          ) : (
            <>
              <div style={{ height: visibleTodos.before }} />
              <div className="space-y-1">
                {visibleTodos.items.map((todo, index) => (
                  <AnimatedTodo
                    key={todo._id || todo.id}
                    todo={todo}
                    category={getTaskCategory(getTodoId(todo))}
                    index={visibleTodos.start + index}
                    onToggle={() => toggleTodo(getTodoId(todo))}
                    onEdit={() => {
                      setEditingTodo(todo);
                      setFormOpen(true);
                    }}
                    onDelete={() => deleteTodo(getTodoId(todo))}
                  />
                ))}
              </div>
              <div style={{ height: visibleTodos.after }} />
            </>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        className="flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Input
          value={quickTodo}
          onChange={(e) => setQuickTodo(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addQuickTodo()}
          placeholder={
            activeFilter === "all"
              ? "Quick add task..."
              : `Quick add to ${categories.find((c) => c.id === activeFilter)?.name || "category"}...`
          }
          className="font-body text-sm border-border"
        />
        <Button onClick={addQuickTodo} variant="outline" size="icon" title="Quick add">
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => {
            setEditingTodo(null);
            setFormOpen(true);
          }}
          variant="outline"
          size="icon"
          title="Add with options"
        >
          <Repeat className="w-4 h-4" />
        </Button>
      </motion.div>

      <TodoForm
        isOpen={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingTodo(null);
        }}
        onSubmit={editingTodo ? updateTodoWithOptions : addTodoWithOptions}
        initialData={editingTodo ? toFormData(editingTodo) : { categoryId: activeFilter !== "all" ? activeFilter : null }}
        mode={editingTodo ? "edit" : "create"}
      />

      <CategoryManager isOpen={managerOpen} onOpenChange={setManagerOpen} />
    </div>
  );
};

export default TodoList;
