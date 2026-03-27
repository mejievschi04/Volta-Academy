import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';

const Stack = createNativeStackNavigator();

export function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Acasă' }} />
      <Stack.Screen
        name="Courses"
        getComponent={() => require('../screens/CoursesScreen').CoursesScreen}
        options={{ title: 'Cursuri' }}
      />
      <Stack.Screen
        name="CourseDetail"
        getComponent={() => require('../screens/CourseDetailScreen').CourseDetailScreen}
        options={{ title: 'Curs' }}
      />
      <Stack.Screen
        name="Lesson"
        getComponent={() => require('../screens/LessonScreen').LessonScreen}
        options={{ title: 'Lecție' }}
      />
    </Stack.Navigator>
  );
}
