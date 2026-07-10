import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Repeat, Flag, Tag } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/use-categories";

export interface TodoFormData {
  title: string;
  repeatType: "none" | "daily" | "weekly" | "monthly" | "yearly";
  repeatInterval: number;
  repeatDays: number[];
  repeatLimit: number | null;
  repeatEndDate: Date | null;
  priority: "low" | "medium" | "high";
  dueDate: Date | null;
  categoryId?: string | null;
}

interface TodoFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TodoFormData) => void;
  initialData?: Partial<TodoFormData>;
  mode?: "create" | "edit";
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const defaultFormData: TodoFormData = {
  title: "",
  repeatType: "none",
  repeatInterval: 1,
  repeatDays: [],
  repeatLimit: null,
  repeatEndDate: null,
  priority: "medium",
  dueDate: null,
  categoryId: null,
};

export const TodoForm = ({ isOpen, onOpenChange, onSubmit, initialData, mode = "create" }: TodoFormProps) => {
  const [title, setTitle] = useState(initialData?.title || "");
  const [repeatType, setRepeatType] = useState<TodoFormData["repeatType"]>(
    initialData?.repeatType || "none"
  );
  const [repeatInterval, setRepeatInterval] = useState(initialData?.repeatInterval || 1);
  const [repeatDays, setRepeatDays] = useState<number[]>(initialData?.repeatDays || []);
  const [repeatLimit, setRepeatLimit] = useState<number | null>(initialData?.repeatLimit ?? null);
  const [hasRepeatLimit, setHasRepeatLimit] = useState(initialData?.repeatLimit !== null && initialData?.repeatLimit !== undefined);
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(initialData?.repeatEndDate || null);
  const [hasRepeatEndDate, setHasRepeatEndDate] = useState(!!initialData?.repeatEndDate);
  const [priority, setPriority] = useState<TodoFormData["priority"]>(initialData?.priority || "medium");
  const [dueDate, setDueDate] = useState<Date | null>(initialData?.dueDate || null);

  useEffect(() => {
    if (!isOpen) return;
    const data = { ...defaultFormData, ...initialData };
    setTitle(data.title);
    setRepeatType(data.repeatType);
    setRepeatInterval(data.repeatInterval);
    setRepeatDays(data.repeatDays);
    setRepeatLimit(data.repeatLimit);
    setHasRepeatLimit(data.repeatLimit !== null && data.repeatLimit !== undefined);
    setRepeatEndDate(data.repeatEndDate);
    setHasRepeatEndDate(!!data.repeatEndDate);
    setPriority(data.priority);
    setDueDate(data.dueDate);
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      repeatType,
      repeatInterval,
      repeatDays,
      repeatLimit: hasRepeatLimit ? repeatLimit : null,
      repeatEndDate: hasRepeatEndDate ? repeatEndDate : null,
      priority,
      dueDate,
    });

    if (mode === "create") {
      setTitle("");
      setRepeatType("none");
      setRepeatInterval(1);
      setRepeatDays([]);
      setRepeatLimit(null);
      setHasRepeatLimit(false);
      setRepeatEndDate(null);
      setHasRepeatEndDate(false);
      setPriority("medium");
      setDueDate(null);
    }
    onOpenChange(false);
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const getIntervalLabel = () => {
    switch (repeatType) {
      case "daily": return repeatInterval === 1 ? "day" : "days";
      case "weekly": return repeatInterval === 1 ? "week" : "weeks";
      case "monthly": return repeatInterval === 1 ? "month" : "months";
      case "yearly": return repeatInterval === 1 ? "year" : "years";
      default: return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "edit" ? "Edit Task" : "Add New Task"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="font-body text-sm">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="font-body"
              autoFocus
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="font-body text-sm flex items-center gap-2">
              <Flag className="w-4 h-4" />
              Priority
            </Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TodoFormData["priority"])}>
              <SelectTrigger className="font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="font-body text-sm flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Due Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-body",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  {dueDate ? format(dueDate, "PPP") : "No due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate || undefined}
                  onSelect={(date) => setDueDate(date || null)}
                  initialFocus
                />
                {dueDate && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDueDate(null)}
                      className="w-full"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Repeat Section */}
          <div className="space-y-3 border-t pt-4">
            <Label className="font-body text-sm flex items-center gap-2">
              <Repeat className="w-4 h-4" />
              Repeat
            </Label>
            
            <Select value={repeatType} onValueChange={(v) => setRepeatType(v as TodoFormData["repeatType"])}>
              <SelectTrigger className="font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Don't repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>

            {repeatType !== "none" && (
              <div className="space-y-3 pl-2 border-l-2 border-muted">
                {/* Interval */}
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm text-muted-foreground">Every</span>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 font-body"
                  />
                  <span className="font-body text-sm text-muted-foreground">{getIntervalLabel()}</span>
                </div>

                {/* Weekly days selection */}
                {repeatType === "weekly" && (
                  <div className="space-y-2">
                    <span className="font-body text-xs text-muted-foreground">On these days:</span>
                    <div className="flex gap-1 flex-wrap">
                      {DAYS_OF_WEEK.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={repeatDays.includes(day.value) ? "default" : "outline"}
                          size="sm"
                          className="w-10 h-8 font-body text-xs"
                          onClick={() => toggleRepeatDay(day.value)}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repeat limit */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hasLimit"
                    checked={hasRepeatLimit}
                    onCheckedChange={(checked) => {
                      setHasRepeatLimit(!!checked);
                      if (!checked) setRepeatLimit(null);
                      else setRepeatLimit(5);
                    }}
                  />
                  <Label htmlFor="hasLimit" className="font-body text-sm cursor-pointer">
                    Limit repetitions
                  </Label>
                  {hasRepeatLimit && (
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      value={repeatLimit || 5}
                      onChange={(e) => setRepeatLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 font-body"
                    />
                  )}
                </div>

                {/* End date */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hasEndDate"
                    checked={hasRepeatEndDate}
                    onCheckedChange={(checked) => {
                      setHasRepeatEndDate(!!checked);
                      if (!checked) setRepeatEndDate(null);
                    }}
                  />
                  <Label htmlFor="hasEndDate" className="font-body text-sm cursor-pointer">
                    End date
                  </Label>
                </div>

                {hasRepeatEndDate && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-body",
                          !repeatEndDate && "text-muted-foreground"
                        )}
                      >
                        {repeatEndDate ? format(repeatEndDate, "PPP") : "Select end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={repeatEndDate || undefined}
                        onSelect={(date) => setRepeatEndDate(date || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {mode === "edit" ? "Save Changes" : "Add Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TodoForm;
