import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { colors, radius, shadows } from '../ui/theme';
import { TAB_BAR_HEIGHT, useTabBarAbsoluteBottom } from './tabBarMetrics';

const Tab = createBottomTabNavigator();
const CoursesStackNav = createNativeStackNavigator();
const EventsStackNav = createNativeStackNavigator();
const MessagesStackNav = createNativeStackNavigator();
const ProfileStackNav = createNativeStackNavigator();

function CoursesStack() {
  return (
    <CoursesStackNav.Navigator screenOptions={stackScreenOptions}>
      <CoursesStackNav.Screen
        name="Courses"
        getComponent={() => require('../screens/CoursesScreen').CoursesScreen}
        options={{ title: 'Cursuri' }}
      />
      <CoursesStackNav.Screen
        name="CourseDetail"
        getComponent={() => require('../screens/CourseDetailScreen').CourseDetailScreen}
        options={{ title: 'Curs' }}
      />
      <CoursesStackNav.Screen
        name="Lesson"
        getComponent={() => require('../screens/LessonScreen').LessonScreen}
        options={{ title: 'Lectie' }}
      />
    </CoursesStackNav.Navigator>
  );
}

function EventsStack() {
  const EventsScreen = require('../screens/EventsScreen').EventsScreen;
  const EventDetailScreen = require('../screens/EventDetailScreen').EventDetailScreen;
  return (
    <EventsStackNav.Navigator screenOptions={stackScreenOptions}>
      <EventsStackNav.Screen name="Events" component={EventsScreen} options={{ title: 'Evenimente' }} />
      <EventsStackNav.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Detalii' }} />
    </EventsStackNav.Navigator>
  );
}

function MessagesStack() {
  const MessagesScreen = require('../screens/MessagesScreen').MessagesScreen;
  const ConversationScreen = require('../screens/ConversationScreen').ConversationScreen;
  return (
    <MessagesStackNav.Navigator screenOptions={stackScreenOptions}>
      <MessagesStackNav.Screen name="Messages" component={MessagesScreen} options={{ title: 'Mesaje' }} />
      <MessagesStackNav.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Conversatie' }} />
    </MessagesStackNav.Navigator>
  );
}

function ProfileStack() {
  const ProfileScreen = require('../screens/ProfileScreen').ProfileScreen;
  const AchievementsScreen = require('../screens/AchievementsScreen').AchievementsScreen;
  const CompletedCoursesScreen = require('../screens/CompletedCoursesScreen').CompletedCoursesScreen;
  const ExamResultsScreen = require('../screens/ExamResultsScreen').ExamResultsScreen;
  return (
    <ProfileStackNav.Navigator screenOptions={stackScreenOptions}>
      <ProfileStackNav.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
      <ProfileStackNav.Screen name="Achievements" component={AchievementsScreen} options={{ title: 'Realizari' }} />
      <ProfileStackNav.Screen name="CompletedCourses" component={CompletedCoursesScreen} options={{ title: 'Cursuri finalizate' }} />
      <ProfileStackNav.Screen name="ExamResults" component={ExamResultsScreen} options={{ title: 'Rezultate examene' }} />
    </ProfileStackNav.Navigator>
  );
}

export function AppTabs() {
  const tabBarBottom = useTabBarAbsoluteBottom();
  const baseTabBarStyle = {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: tabBarBottom,
    backgroundColor: colors.bgSecondary,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderTopWidth: 1,
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: radius.xxl,
    height: TAB_BAR_HEIGHT,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
    zIndex: 1000,
    elevation: 20,
    ...shadows.md,
  };

  return (
    <Tab.Navigator
      initialRouteName="Cursuri"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: baseTabBarStyle,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarIcon: ({ color, size, focused }) => {
          const iconName =
            route.name === 'Cursuri'
              ? focused
                ? 'library'
                : 'library-outline'
              : route.name === 'Evenimente'
                ? focused
                  ? 'calendar'
                  : 'calendar-outline'
                : route.name === 'Mesaje'
                  ? focused
                    ? 'chatbubbles'
                    : 'chatbubbles-outline'
                  : focused
                    ? 'person'
                    : 'person-outline';
          return <Ionicons name={iconName} size={size ?? 20} color={color} />;
        },
        tabBarItemStyle: { borderRadius: radius.lg },
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen
        name="Cursuri"
        component={CoursesStack}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'Courses';
          const hideBar = routeName === 'CourseDetail' || routeName === 'Lesson';
          return {
            tabBarStyle: hideBar ? { display: 'none' } : baseTabBarStyle,
          };
        }}
      />
      <Tab.Screen name="Evenimente" component={EventsStack} />
      <Tab.Screen
        name="Mesaje"
        component={MessagesStack}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'Messages';
          const hideBar = routeName === 'Conversation';
          return {
            tabBarStyle: hideBar ? { display: 'none' } : baseTabBarStyle,
          };
        }}
      />
      <Tab.Screen name="Profil" component={ProfileStack} />
    </Tab.Navigator>
  );
}

const stackScreenOptions = {
  headerShown: false,
};
