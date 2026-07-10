import { useState } from "react";
import { useReminders } from "@/contexts/RemindersContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Bell, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { ReminderForm } from "@/components/ReminderForm";

interface AnimatedReminderProps {
  reminder: {
    _id?: string;
    id?: string;
    title: string;
    date: Date | string;
    completed: boolean;
  };
  onToggle: () => void;
  onDelete: () => void;
  index: number;
}

const AnimatedReminder = ({ reminder, onToggle, onDelete, index }: AnimatedReminderProps) => {
  // Ensure date is a proper Date object
  const reminderDate = reminder.date instanceof Date ? reminder.date : new Date(reminder.date);
  const isOverdue = isPast(reminderDate) && !isToday(reminderDate) && !reminder.completed;
  
  const formatReminderDate = (date: Date) => {
    if (isToday(date)) return format(date, "'Today at' h:mm a");
    if (isTomorrow(date)) return format(date, "'Tomorrow at' h:mm a");
    return format(date, "MMM d 'at' h:mm a");
  };

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, x: -100 }}
      transition={{ 
        duration: 0.25, 
        delay: index * 0.05,
        layout: { duration: 0.2 }
      }}
      className="flex items-start gap-3 group"
    >
      <Checkbox
        checked={reminder.completed}
        onCheckedChange={onToggle}
        className="border-foreground data-[state=checked]:bg-foreground mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <motion.span
          animate={{ opacity: reminder.completed ? 0.5 : 1 }}
          transition={{ duration: 0.2 }}
          className={`font-body text-sm block ${
            reminder.completed ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {reminder.title}
        </motion.span>
        <span className={`font-body text-xs flex items-center gap-1 mt-0.5 ${
          isOverdue ? "text-destructive" : "text-muted-foreground"
        }`}>
          <Clock className="w-3 h-3" />
          {formatReminderDate(reminderDate)}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity flex-shrink-0"
      >
        <X className="w-3 h-3" />
      </Button>
    </motion.div>
  );
};

const RemindersList = () => {
  const { reminders, updateReminder, deleteReminder, getUpcomingReminders, getOverdueReminders } = useReminders();
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Get upcoming (7 days) and overdue reminders
  const upcomingReminders = getUpcomingReminders(7);
  const overdueReminders = getOverdueReminders();
  const displayedReminders = [...overdueReminders, ...upcomingReminders].slice(0, 10);

  const toggleReminder = async (id: string, completed: boolean) => {
    await updateReminder(id, { completed: !completed });
  };

  const handleDelete = async (id: string) => {
    await deleteReminder(id);
  };

  const completedCount = reminders.filter(r => r.completed).length;

  return (
    <div className="border border-border rounded-md p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <span className="font-body text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Bell className="w-3 h-3" />
          Reminders
        </span>
        <span className="font-body text-xs text-muted-foreground tabular-nums">
          {completedCount}/{reminders.length}
        </span>
      </div>

      <div className="space-y-3 mb-5 max-h-[240px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {displayedReminders.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-body text-sm text-muted-foreground text-center py-6"
            >
              No upcoming reminders
            </motion.p>
          ) : (
            displayedReminders.map((reminder, index) => (
              <AnimatedReminder
                key={reminder._id || reminder.id}
                reminder={reminder}
                index={index}
                onToggle={() => toggleReminder(reminder._id || reminder.id || "", reminder.completed)}
                onDelete={() => handleDelete(reminder._id || reminder.id || "")}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Button 
          onClick={() => setIsFormOpen(true)} 
          variant="outline" 
          size="sm"
          className="w-full gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Reminder
        </Button>
      </motion.div>

      <ReminderForm isOpen={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  );
};

export default RemindersList;
