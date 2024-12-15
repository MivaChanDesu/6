import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Button,
  FlatList,
  Alert,
  TextInput,
  StyleSheet,
} from "react-native";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import * as Notifications from "expo-notifications";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AntDesign } from "@expo/vector-icons";
import * as Linking from "expo-linking";

// Настройка обработчиков уведомлений
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function initializeDatabase(db) {
  try {
    await db.execAsync(`
     PRAGMA journal_mode = WAL;
     CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        message TEXT,
        date TEXT
     );
    `);
    console.log("Database initialized");
  } catch (error) {
    console.log("Error while initializing database: ", error);
  }
}

const ReminderButton = ({ reminder, deleteReminder }) => {
  return (
    <View style={styles.reminderButton}>
      <View style={styles.reminderTextContainer}>
        <Text style={styles.reminderTitle}>{reminder.title}</Text>
        <Text style={styles.reminderMessage}>{reminder.message}</Text>
        <Text style={styles.reminderDate}>
          {new Date(reminder.date).toLocaleString()}
        </Text>
      </View>
      <AntDesign
        name="delete"
        size={18}
        color="red"
        onPress={() => deleteReminder(reminder.id)}
        style={styles.icon}
      />
    </View>
  );
};

const App = () => {
  return (
    <SQLiteProvider databaseName="reminders.db" onInit={initializeDatabase}>
      <View style={styles.container}>
        <Text style={styles.title}>Напоминания</Text>
        <Content />
      </View>
    </SQLiteProvider>
  );
};

const Content = () => {
  const db = useSQLiteContext();
  const [reminders, setReminders] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Разрешение на уведомления не предоставлено!");
      }
    };

    requestPermissions();
    loadReminders();

    // Подписка на получение уведомлений
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Уведомление получено:", notification);
      }
    );

    // Обработка нажатия на уведомление
    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const { title, body } = response.notification.request.content;
        Alert.alert(title, body);
      });

    return () => {
      subscription.remove();
      responseListener.remove();
    };
  }, []);

  const loadReminders = async () => {
    try {
      const allRows = await db.getAllAsync("SELECT * FROM reminders");
      setReminders(allRows);
    } catch (error) {
      console.log("Error while loading reminders: ", error);
    }
  };

  const addReminder = async () => {
    try {
      await db.runAsync(
        "INSERT INTO reminders (title, message, date) VALUES (?, ?, ?)",
        [title, message, date.toISOString()]
      );
      await scheduleNotification(title, message, date);
      await loadReminders();
    } catch (error) {
      console.log("Error while adding reminder: ", error);
    }
  };

  const deleteReminder = async (id) => {
    try {
      await db.runAsync("DELETE FROM reminders WHERE id = ?", [id]);
      await Notifications.cancelScheduledNotificationAsync(id.toString());
      await loadReminders();
    } catch (error) {
      console.log("Error while deleting reminder: ", error);
    }
  };

  const scheduleNotification = async (title, message, date) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: message,
          sound: true,
          // Установите иконку уведомления
          // Убедитесь, что иконка добавлена в проект и указана в app.json
          icon: require("./assets/icon.png"),
        },
        trigger: { date: date },
      });
    } catch (error) {
      console.log("Error scheduling notification: ", error);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(false);
    setDate(currentDate);
  };

  const handleTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || date;
    setShowTimePicker(false);
    setDate(currentTime);
  };

  return (
    <View style={styles.contentContainer}>
      <TextInput
        style={styles.input}
        placeholder="Заголовок"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Текст уведомления"
        value={message}
        onChangeText={setMessage}
      />
      <Button title="Выбрать дату" onPress={() => setShowDatePicker(true)} />
      <Button title="Выбрать время" onPress={() => setShowTimePicker(true)} />
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={date}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
      <Button title="Добавить напоминание" onPress={addReminder} />
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ReminderButton reminder={item} deleteReminder={deleteReminder} />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 60,
    marginBottom: 20,
  },
  contentContainer: {
    flex: 1,
    width: "90%",
  },
  reminderButton: {
    backgroundColor: "lightblue",
    padding: 10,
    marginVertical: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reminderTextContainer: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  reminderMessage: {
    fontSize: 16,
    color: "#555",
  },
  reminderDate: {
    fontSize: 14,
    color: "#888",
  },
  icon: {
    marginHorizontal: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    marginVertical: 3,
  },
});

export default App;
