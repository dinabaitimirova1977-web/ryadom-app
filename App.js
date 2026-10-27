import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Linking,
  Platform,
} from "react-native";

import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

WebBrowser.maybeCompleteAuthSession();

const API_URL = 'https://ryadom-backend-production.up.railway.app';
const SEARCH_RADIUS_KM = 30; // весь Атырау

// Кнопка «Стать партнёром», цена и оплата есть только в APK для кафе (канал apk-partners).
// В App Store, Google Play и APK для всех их нет. В Expo Go (Snack) видно для проверки.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const IS_APK = Updates.channel === 'apk-partners' || IS_EXPO_GO;
const KASPI_PAY_URL = 'https://pay.kaspi.kz/pay/y0lpmrri';
const PARTNER_PRICE = '25 000 ₸';

// ===== Связь по телефону =====
const phoneDigits = (phone) => String(phone || '').replace(/\D/g, '');

const openWhatsApp = (phone, adTitle) => {
  const text = adTitle
    ? `Здравствуйте! Пишу из приложения «Рядом» по объявлению: «${adTitle}»`
    : 'Здравствуйте! Пишу из приложения «Рядом»';
  Linking.openURL(`https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(text)}`);
};

const callPhone = (phone) => {
  Linking.openURL(`tel:+${phoneDigits(phone)}`);
};

// Синяя точка «Вы здесь» для карт Leaflet
const myDotJs = (lat, lng) =>
  `L.circleMarker([${lat},${lng}],{radius:8,color:'#fff',weight:3,fillColor:'#1E88E5',fillOpacity:1}).addTo(map)`;

export default function App() {
  const [step, setStep] = useState('phone'); // phone (экран входа), role, createRequest, browseRequests
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  const [category, setCategory] = useState('food');
  const [requestType, setRequestType] = useState('need');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');

  const [requests, setRequests] = useState([]);
  const [offers, setOffers] = useState([]);
  const [respondedIds, setRespondedIds] = useState([]);
  const [contacts, setContacts] = useState({}); // requestId -> { name, phone, title }
  const [contact, setContact] = useState(null); // открытое окно «Связаться»
  const [myRequests, setMyRequests] = useState([]);
  const [userLat, setUserLat] = useState(47.1164);
  const [userLng, setUserLng] = useState(51.9126);
  const [mapVisible, setMapVisible] = useState(false);
  const [pickerCenter, setPickerCenter] = useState({ lat: 47.1164, lng: 51.9126 });
  const [browseViewMode, setBrowseViewMode] = useState('list');
  const [mapCategoryFilter, setMapCategoryFilter] = useState('all');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRequestId, setReviewRequestId] = useState(null);
  const [reviewToUserId, setReviewToUserId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [profileVisible, setProfileVisible] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileReviews, setProfileReviews] = useState([]);
  const [venueVisible, setVenueVisible] = useState(false);
  const [cafesOnly, setCafesOnly] = useState(false);
  const [venueData, setVenueData] = useState(null);
  const [partnerInfo, setPartnerInfo] = useState(null);
  const [partnerStatus, setPartnerStatus] = useState('none');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueHours, setVenueHours] = useState('');
  const [venuePhone, setVenuePhone] = useState('');

  // Телефон для связи
  const [userPhone, setUserPhone] = useState(null);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [phoneInput, setPhoneInput] = useState('+7');
  const userPhoneRef = useRef(null);
  const pendingActionRef = useRef(null);

  // Карты
  const pickerMapRef = useRef(null);
  const browseMapRef = useRef(null);

  const rememberPhone = (phone) => {
    userPhoneRef.current = phone || null;
    setUserPhone(phone || null);
  };

  const fetchUserPhone = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/requests/phone/${id}`);
      const data = await res.json();
      rememberPhone(data.phone);
    } catch (e) {
      console.log('Phone fetch error:', e.message);
    }
  };

  useEffect(() => {
    const loadSavedUser = async () => {
      const savedId = await AsyncStorage.getItem('userId');
      const savedName = await AsyncStorage.getItem('userName');
      if (savedId) {
        setUserId(savedId);
        setUserName(savedName || 'Пользователь');
        setStep('role');
        fetchUserPhone(savedId);
      }
    };
    loadSavedUser();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    }
  }, []);

  // Общий шаг после входа через Google или Apple
  const saveUser = async (user) => {
    const name = user.name || 'Пользователь';
    setUserId(user.id);
    setUserName(name);
    rememberPhone(user.phone);
    await AsyncStorage.setItem('userId', String(user.id));
    await AsyncStorage.setItem('userName', name);
    setStep('role');
    fetchUserPhone(user.id);
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const redirectUrl = 'ryadom://auth';
      const startUrl = `${API_URL}/api/auth/google/start?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUrl);

      if (result.type !== 'success' || !result.url) {
        setLoading(false);
        return; // пользователь закрыл окно
      }

      const { queryParams } = ExpoLinking.parse(result.url);
      const authCode = queryParams && queryParams.code;
      if (!authCode) {
        Alert.alert('Ошибка', 'Google не вернул код входа. Попробуйте ещё раз.');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/auth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        await saveUser(data.user);
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось войти через Google');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const loginWithApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      setLoading(true);
      const fullName = [
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      ]
        .filter(Boolean)
        .join(' ');

      const res = await fetch(`${API_URL}/api/auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityToken: credential.identityToken,
          authorizationCode: credential.authorizationCode,
          fullName,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        await saveUser(data.user);
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось войти через Apple');
      }
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Ошибка', e.message);
      }
    }
    setLoading(false);
  };

  // ===== Телефон для связи =====

  // Открыть окно ввода номера. После сохранения выполнится action (если передан).
  const askPhone = (action) => {
    pendingActionRef.current = action || null;
    setPhoneInput(userPhoneRef.current || '+7');
    setPhoneModalVisible(true);
  };

  const savePhone = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/requests/set-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, phone: phoneInput }),
      });
      const data = await res.json();
      if (data.success) {
        rememberPhone(data.phone);
        setPhoneModalVisible(false);
        setLoading(false);
        const next = pendingActionRef.current;
        pendingActionRef.current = null;
        if (next) next();
        return;
      }
      Alert.alert('Ошибка', data.error || 'Не удалось сохранить номер');
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const openProfile = async (targetUserId) => {
    try {
      const resUser = await fetch(`${API_URL}/api/users/${targetUserId}`);
      const dataUser = await resUser.json();
      const resReviews = await fetch(`${API_URL}/api/requests/reviews/${targetUserId}`);
      const dataReviews = await resReviews.json();
      setProfileData(dataUser.user || null);
      setProfileReviews(dataReviews.reviews || []);
      setProfileVisible(true);
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
  };

  const donate = () => {
    Linking.openURL('https://dinabaitimirova1977-web.github.io/ryadom-app/support.html');
  };
  const logout = async () => {
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('userName');
    setUserId(null);
    rememberPhone(null);
    setStep('phone');
  };
  const deleteAccount = () => {
    Alert.alert(
      'Удалить аккаунт',
      'Это действие необратимо. Все ваши данные будут удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
              if (res.ok) {
                await AsyncStorage.clear();
                setUserId(null);
                rememberPhone(null);
                setStep('phone');
                Alert.alert('Готово', 'Аккаунт удалён');
              } else {
                Alert.alert('Ошибка', 'Не удалось удалить аккаунт');
              }
            } catch (e) {
              Alert.alert('Ошибка сети', e.message);
            }
          },
        },
      ]
    );
  };

  // ===== Местоположение =====

  // Возвращает { lat, lng } или null, если доступа нет
  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Геолокация',
          'Без доступа к геолокации будут показаны примерные координаты (Атырау). Место можно отметить на карте вручную.'
        );
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setUserLat(latitude);
      setUserLng(longitude);
      return { lat: latitude, lng: longitude };
    } catch (e) {
      console.log('Location error:', e.message);
      return null;
    }
  };

  // Микрорайон и улица по точке на карте (номер дома не берём)
  const lookupAddress = async (lat, lng) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const a = results && results[0];
      if (!a) return;
      const parts = [a.district, a.street || a.name].filter(Boolean);
      const text = [...new Set(parts)].join(', ');
      if (text) setAddress(text);
    } catch (e) {
      console.log('Reverse geocode error:', e.message);
    }
  };

  const openPicker = () => {
    setPickerCenter({ lat: userLat, lng: userLng });
    setMapVisible(true);
  };

  // ➤ в окне выбора места: поставить булавку туда, где я сейчас
  const pickerGoToMe = async () => {
    const c = await getUserLocation();
    if (c && pickerMapRef.current) {
      pickerMapRef.current.injectJavaScript(`goTo(${c.lat},${c.lng});true;`);
    }
  };

  // ➤ на карте объявлений: вернуть карту ко мне
  const browseGoToMe = async () => {
    const c = await getUserLocation();
    if (c && browseMapRef.current) {
      browseMapRef.current.injectJavaScript(`goTo(${c.lat},${c.lng});true;`);
    }
  };

  const closePicker = () => {
    setMapVisible(false);
    if (step === 'createRequest') lookupAddress(userLat, userLng);
  };

  // ===== Объявления =====

  const openCreateRequest = async (type) => {
    setRequestType(type);
    setCategory('food');
    setTitle('');
    setDescription('');
    setAddress('');
    setStep('createRequest');
    const c = await getUserLocation();
    if (c) lookupAddress(c.lat, c.lng);
  };

  const selectRole = async (selectedRole) => {
    if (selectedRole === 'needer') {
      setStep('neederChoice');
    } else {
      setStep('browseRequests');
      const c = await getUserLocation();
      loadRequests(c);
    }
  };

  const openOffers = async (onlyCafes) => {
    setCafesOnly(onlyCafes);
    setStep('browseOffers');
    const c = await getUserLocation();
    loadOffers(c);
  };

  const createRequest = async () => {
    if (!title) {
      Alert.alert('Ошибка', 'Введите заголовок запроса');
      return;
    }
    if (!userPhoneRef.current) {
      askPhone(createRequest);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          category,
          title,
          description,
          address: address.trim(),
          lat: userLat,
          lng: userLng,
          type: requestType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Готово!', 'Ваш запрос опубликован');
        setTitle('');
        setDescription('');
        setAddress('');
        setStep('role');
      } else if (data.code === 'PHONE_REQUIRED') {
        setLoading(false);
        askPhone(createRequest);
        return;
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось создать запрос');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const loadRequests = async (coords) => {
    const lat = coords && coords.lat ? coords.lat : userLat;
    const lng = coords && coords.lng ? coords.lng : userLng;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/requests?lat=${lat}&lng=${lng}&type=need&radius=${SEARCH_RADIUS_KM}`
      );
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };
  const loadOffers = async (coords) => {
    const lat = coords && coords.lat ? coords.lat : userLat;
    const lng = coords && coords.lng ? coords.lng : userLng;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/requests?lat=${lat}&lng=${lng}&type=offer&radius=${SEARCH_RADIUS_KM}`
      );
      const data = await res.json();
      setOffers(data.requests || []);
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };
  const loadMyRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/requests/my/${userId}`);
      const data = await res.json();
      setMyRequests(data.requests || []);
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const respondToRequest = async (requestId, adTitle) => {
    if (!userPhoneRef.current) {
      askPhone(() => respondToRequest(requestId, adTitle));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helper_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        const info = {
          name: data.requester?.name || 'сосед',
          phone: data.requester?.phone || null,
          title: adTitle || '',
        };
        setContacts({ ...contacts, [requestId]: info });
        setRespondedIds([...respondedIds, requestId]);
        setContact(info);
      } else if (data.code === 'PHONE_REQUIRED') {
        setLoading(false);
        askPhone(() => respondToRequest(requestId, adTitle));
        return;
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось откликнуться');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const completeRequest = async (requestId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/requests/${requestId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        setReviewRequestId(requestId);
        setReviewRating(5);
        setReviewComment('');
        setReviewModalVisible(true);
        loadMyRequests();
        loadRequests();
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось завершить заявку');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };
  const submitReview = async () => {
    if (!reviewToUserId) {
      setReviewModalVisible(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/requests/${reviewRequestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: userId,
          to_user_id: reviewToUserId,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Спасибо!', 'Ваш отзыв сохранён');
        setReviewModalVisible(false);
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось отправить отзыв');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  // ===== Партнёры =====
  const openVenue = async (ownerId) => {
    try {
      const res = await fetch(`${API_URL}/api/partners/by-user/${ownerId}`);
      const data = await res.json();
      if (data.partner) {
        setVenueData(data.partner);
        setVenueVisible(true);
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
  };

  const openDirections = (v) => {
    const query = v.lat && v.lng ? `${v.lat},${v.lng}` : encodeURIComponent(v.address || v.venue_name);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const loadMyPartner = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/partners/my/${userId}`);
      const data = await res.json();
      setPartnerInfo(data.partner || null);
      setPartnerStatus(data.status || 'none');
      if (data.partner) {
        setVenueName(data.partner.venue_name || '');
        setVenueAddress(data.partner.address || '');
        setVenueHours(data.partner.hours || '');
        setVenuePhone(data.partner.phone || '');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const applyPartner = async () => {
    if (!venueName.trim() || !venueAddress.trim()) {
      Alert.alert('Ошибка', 'Укажите название и адрес заведения');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/partners/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          venue_name: venueName.trim(),
          address: venueAddress.trim(),
          hours: venueHours.trim(),
          phone: venuePhone.trim(),
          lat: userLat,
          lng: userLng,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPartnerInfo(data.partner);
        setPartnerStatus('pending');
        Alert.alert('Заявка отправлена', 'Мы проверим её и подключим вас в течение дня.');
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось отправить заявку');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const payPartner = () => {
    Alert.alert(
      'Оплата через Kaspi',
      `Оплатите ${PARTNER_PRICE} и в комментарии к платежу укажите название заведения. Статус продлится в течение дня после оплаты.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Перейти к оплате', onPress: () => Linking.openURL(KASPI_PAY_URL) },
      ]
    );
  };

  const renderPartnerBadge = (item) =>
    item.is_partner ? (
      <TouchableOpacity onPress={() => openVenue(item.user_id)} style={styles.partnerBadge}>
        <Text style={styles.partnerBadgeText}>
          ⭐ Партнёр Рядом{item.partner_venue_name ? ` · ${item.partner_venue_name}` : ''}
        </Text>
      </TouchableOpacity>
    ) : null;

  const renderAddress = (item) =>
    item.address ? <Text style={styles.addressText}>📍 {item.address}</Text> : null;

  // Кнопки «WhatsApp» и «Позвонить»
  const renderContactButtons = (phone, adTitle) =>
    phone ? (
      <View style={styles.contactRow}>
        <TouchableOpacity style={styles.whatsappButton} onPress={() => openWhatsApp(phone, adTitle)}>
          <Text style={styles.contactButtonText}>💬 WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.callButton} onPress={() => callPhone(phone)}>
          <Text style={styles.contactButtonText}>📞 Позвонить</Text>
        </TouchableOpacity>
      </View>
    ) : null;

  const sendReport = async (requestId, reason) => {
    try {
      const res = await fetch(`${API_URL}/api/requests/${requestId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reporter_id: userId, reason: reason || '' }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Спасибо', 'Жалоба отправлена, мы проверим объявление.');
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось отправить жалобу');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
  };

  const confirmReport = (requestId) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Пожаловаться',
        'Опишите, в чём нарушение (необязательно)',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Отправить', onPress: (text) => sendReport(requestId, text) },
        ],
        'plain-text'
      );
    } else {
      Alert.alert('Пожаловаться', 'Сообщить о нарушении в этом объявлении?', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Пожаловаться', onPress: () => sendReport(requestId, '') },
      ]);
    }
  };

  // ===== HTML карт =====

  const pickerHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>#map{height:100vh;width:100vw;margin:0;padding:0;}</style></head><body style="margin:0;padding:0;"><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
var map=L.map('map').setView([${pickerCenter.lat},${pickerCenter.lng}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
var marker=L.marker([${pickerCenter.lat},${pickerCenter.lng}],{draggable:true}).addTo(map);
var me=null;
function sendCoords(lat,lng){window.ReactNativeWebView.postMessage(JSON.stringify({lat:lat,lng:lng}));}
function goTo(lat,lng){map.setView([lat,lng],16);marker.setLatLng([lat,lng]);if(me){me.setLatLng([lat,lng]);}else{me=L.circleMarker([lat,lng],{radius:8,color:'#fff',weight:3,fillColor:'#1E88E5',fillOpacity:1}).addTo(map);}sendCoords(lat,lng);}
marker.on('dragend',function(e){var pos=marker.getLatLng();sendCoords(pos.lat,pos.lng);});
map.on('click',function(e){marker.setLatLng(e.latlng);sendCoords(e.latlng.lat,e.latlng.lng);});
</script></body></html>`;

  const filteredForMap = requests.filter(
    (r) => mapCategoryFilter === 'all' || r.category === mapCategoryFilter
  );
  const browseHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>#map{height:100vh;width:100vw;margin:0;padding:0;}</style></head><body style="margin:0;padding:0;"><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
var map=L.map('map').setView([${userLat},${userLng}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
var me=${myDotJs(userLat, userLng)}.bindPopup('Вы здесь');
function goTo(lat,lng){map.setView([lat,lng],15);me.setLatLng([lat,lng]);}
${filteredForMap
  .map(
    (r) =>
      `L.marker([${r.lat},${r.lng}]).addTo(map).bindPopup(${JSON.stringify(
        r.title + (r.address ? ' — ' + r.address : '')
      )});`
  )
  .join('')}
</script></body></html>`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Рядом</Text>
      <Text style={styles.subtitle}>Помогаем соседям</Text>

      {step === 'phone' && (
        <>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={loginWithGoogle}
            disabled={loading}>
            <Text style={styles.googleButtonText}>
              {loading ? 'Вход...' : 'Войти через Google'}
            </Text>
          </TouchableOpacity>

          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={styles.appleButton}
              onPress={loginWithApple}
            />
          )}
        </>
      )}

      {step === 'role' && (
        <>
          <Text style={styles.welcome}>Добро пожаловать, {userName}!</Text>
          <Text style={styles.question}>Кто вы?</Text>

          <TouchableOpacity
            style={styles.roleButton}
            onPress={() => selectRole('needer')}>
            <Text style={styles.roleButtonText}>🙋 Нуждающийся</Text>
            <Text style={styles.roleButtonSubtext}>Мне нужна помощь</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roleButton}
            onPress={() => selectRole('helper')}>
            <Text style={styles.roleButtonText}>🤝 Помогающий</Text>
            <Text style={styles.roleButtonSubtext}>Хочу помочь соседям</Text>
          </TouchableOpacity>
          {IS_APK && (
            <TouchableOpacity
              style={styles.roleButton}
              onPress={() => {
                loadMyPartner();
                setStep('partner');
              }}>
              <Text style={styles.roleButtonText}>🏪 Для кафе и ресторанов</Text>
              <Text style={styles.roleButtonSubtext}>Стать партнёром Рядом</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={() => askPhone(null)}>
            <Text style={styles.linkButtonText}>
              📞 {userPhone ? `Номер для связи: ${userPhone} · изменить` : 'Указать номер для связи'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.donateButton} onPress={donate}>
            <Text style={styles.donateButtonText}>💛 Помощь проекту</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'neederChoice' && (
        <>
          <Text style={styles.question}>Что вы хотите сделать?</Text>

          <TouchableOpacity
            style={styles.roleButton}
            onPress={() => openCreateRequest('need')}>
            <Text style={styles.roleButtonText}>🙋 Мне нужна помощь</Text>
            <Text style={styles.roleButtonSubtext}>Создать запрос о помощи</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleButton, styles.cafesButton]}
            onPress={() => openOffers(true)}>
            <Text style={styles.roleButtonText}>🍽 Кафе рядом раздают еду</Text>
            <Text style={styles.roleButtonSubtext}>Бесплатная еда от кафе-партнёров</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roleButton}
            onPress={() => openOffers(false)}>
            <Text style={styles.roleButtonText}>🎁 Посмотреть, что предлагают</Text>
            <Text style={styles.roleButtonSubtext}>Взять то, что отдают соседи</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('role')}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'createRequest' && (
        <ScrollView style={{ width: '100%' }}>
          <Text style={styles.question}>
            {requestType === 'offer' ? 'Что вы готовы отдать?' : 'Что вам нужно?'}
          </Text>

          <View style={styles.categoryRow}>
            <TouchableOpacity
              style={[
                styles.categoryButton,
                category === 'food' && styles.categoryButtonSelected,
              ]}
              onPress={() => setCategory('food')}>
              <Text style={styles.categoryButtonText}>🍲 Еда</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.categoryButton,
                category === 'clothing' && styles.categoryButtonSelected,
              ]}
              onPress={() => setCategory('clothing')}>
              <Text style={styles.categoryButtonText}>👕 Одежда</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.safetyBox}>
            <Text style={styles.safetyText}>
              🤝 Помощь в «Рядом» всегда бесплатна. Не просите и не переводите деньги, не вносите «предоплату за доставку».
            </Text>
          </View>
          {category === 'food' && (
            <Text style={styles.expiryHint}>
              ⏱ Объявления о еде автоматически скрываются через 24 часа
            </Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="Коротко, что нужно"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Подробности (необязательно)"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <TextInput
            style={[styles.input, { marginBottom: 4 }]}
            placeholder="Микрорайон и улица, например: Нурсая, ул. Сатпаева"
            value={address}
            onChangeText={setAddress}
          />
          <Text style={styles.fieldHint}>
            Видно всем. Номер дома не пишите — договоритесь о встрече по телефону.
          </Text>

          <TouchableOpacity style={styles.mapButton} onPress={openPicker}>
            <Text style={styles.mapButtonText}>📍 Уточнить место на карте</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { marginTop: 16 }]}
            onPress={createRequest}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? 'Публикация...' : 'Опубликовать'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              loadMyRequests();
              setStep('myRequests');
            }}>
            <Text style={styles.linkButtonText}>📋 Мои запросы</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('role')}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Выбор места на карте */}
      <Modal visible={mapVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <Text style={styles.mapHint}>
            Передвиньте булавку или нажмите ➤, чтобы отметить, где вы сейчас
          </Text>
          <View style={{ flex: 1 }}>
            <WebView
              ref={pickerMapRef}
              style={{ flex: 1 }}
              source={{ html: pickerHtml }}
              onMessage={(event) => {
                const data = JSON.parse(event.nativeEvent.data);
                setUserLat(data.lat);
                setUserLng(data.lng);
              }}
            />
            <TouchableOpacity style={styles.locateButton} onPress={pickerGoToMe}>
              <Text style={styles.locateButtonText}>➤</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.button, { margin: 16, width: undefined }]} onPress={closePicker}>
            <Text style={styles.buttonText}>Готово</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Номер телефона для связи */}
      <Modal visible={phoneModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.welcome, { textAlign: 'left' }]}>Номер для связи</Text>
            <Text style={styles.requestDesc}>
              Номер увидит только тот, с кем вы договоритесь о помощи. Лучше указать номер с WhatsApp.
            </Text>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="+7 7XX XXX XX XX"
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity style={styles.button} onPress={savePhone} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? 'Сохранение...' : 'Сохранить'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 12, alignItems: 'center' }}
              onPress={() => {
                pendingActionRef.current = null;
                setPhoneModalVisible(false);
              }}>
              <Text style={{ color: '#999' }}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Связаться после отклика */}
      <Modal visible={!!contact} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {contact && (
              <>
                <Text style={[styles.welcome, { textAlign: 'left' }]}>Вы откликнулись!</Text>
                {contact.phone ? (
                  <>
                    <Text style={styles.requestDesc}>
                      Договоритесь с {contact.name} о встрече:
                    </Text>
                    {renderContactButtons(contact.phone, contact.title)}
                  </>
                ) : (
                  <Text style={styles.requestDesc}>
                    {contact.name} ещё не указал номер. Он увидит ваш отклик в «Моих запросах» и свяжется с вами сам.
                  </Text>
                )}
                <View style={[styles.safetyBox, { marginTop: 14, marginBottom: 0 }]}>
                  <Text style={styles.safetyText}>
                    🛡 Встречайтесь днём в людных местах. Помощь в «Рядом» всегда бесплатна — не переводите и не просите деньги.
                  </Text>
                </View>
              </>
            )}
            <TouchableOpacity
              style={{ marginTop: 14, alignItems: 'center' }}
              onPress={() => setContact(null)}>
              <Text style={{ color: '#999' }}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={reviewModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.question}>Оцените помощь</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 16 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                  <Text style={{ fontSize: 32, marginHorizontal: 4 }}>
                    {star <= reviewRating ? '⭐' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Комментарий (необязательно)"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />
            <TouchableOpacity
              style={styles.button}
              onPress={submitReview}
              disabled={loading}>
              <Text style={styles.buttonText}>Отправить отзыв</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 12, alignItems: 'center' }}
              onPress={() => setReviewModalVisible(false)}>
              <Text style={{ color: '#999' }}>Пропустить</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={profileVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            {profileData && (
              <>
                <Text style={styles.question}>{profileData.name}</Text>
                <Text style={{ fontSize: 18, marginBottom: 16 }}>
                  ⭐ {profileData.rating ? Number(profileData.rating).toFixed(1) : '0.0'} ({profileData.reviews_count || 0} отзывов)
                </Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {profileReviews.length === 0 ? (
                    <Text style={styles.emptyText}>Отзывов пока нет</Text>
                  ) : (
                    profileReviews.map((rv) => (
                      <View key={rv.id} style={styles.requestCard}>
                        <Text>{'⭐'.repeat(rv.rating)}</Text>
                        <Text style={{ color: '#666', marginTop: 4 }}>{rv.from_user_name}</Text>
                        {rv.comment ? <Text style={{ marginTop: 4 }}>{rv.comment}</Text> : null}
                      </View>
                    ))
                  )}
                </ScrollView>
              </>
            )}
            <TouchableOpacity
              style={{ marginTop: 12, alignItems: 'center' }}
              onPress={() => setProfileVisible(false)}>
              <Text style={{ color: '#999' }}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {step === 'myRequests' && (
        <ScrollView style={{ width: '100%' }}>
          <Text style={styles.question}>Мои запросы</Text>

          {loading && <Text>Загрузка...</Text>}

          {!loading && myRequests.length === 0 && (
            <Text style={styles.emptyText}>У вас пока нет запросов</Text>
          )}

          {myRequests.map((r) => (
            <View key={r.id} style={styles.requestCard}>
              <Text style={styles.requestTitle}>
                {r.category === 'food' ? '🍲' : '👕'} {r.title}
              </Text>
              {r.description ? (
                <Text style={styles.requestDesc}>{r.description}</Text>
              ) : null}
              {renderAddress(r)}

              {r.responses && r.responses.length > 0 ? (
                r.responses.map((resp) => (
                  <View key={resp.id} style={styles.responseItem}>
                    <Text style={styles.responseText}>
                      🧑 <Text onPress={() => openProfile(resp.helper_id)} style={{ textDecorationLine: 'underline' }}>{resp.helper_name}</Text> откликнулся
                    </Text>
                    {resp.helper_phone ? (
                      renderContactButtons(resp.helper_phone, r.title)
                    ) : (
                      <Text style={styles.noResponseText}>Номер не указан</Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noResponseText}>
                  Пока никто не откликнулся
                </Text>
              )}
              {r.status === 'completed' ? (
                <Text style={styles.respondedText}>✅ Завершено</Text>
              ) : (
                <TouchableOpacity
                  style={styles.helpButton}
                  onPress={() => {
                    const helperId = r.responses && r.responses.length > 0 ? r.responses[0].helper_id : null;
                    setReviewToUserId(helperId);
                    completeRequest(r.id);
                  }}
                  disabled={loading}>
                  <Text style={styles.helpButtonText}>Помощь оказана</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}>
            <Text style={styles.logoutButtonText}>Выйти</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={deleteAccount}>
            <Text style={styles.deleteButtonText}>Удалить аккаунт</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('createRequest')}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'browseRequests' && (
        <ScrollView style={{ width: '100%' }}>
          <Text style={styles.question}>Кто рядом нуждается в помощи?</Text>
          <View style={styles.safetyBox}>
            <Text style={styles.safetyText}>
              🛡 Встречайтесь днём в людных местах. Помощь всегда бесплатна — не переводите деньги.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.viewModeButton, browseViewMode === 'list' && styles.viewModeButtonActive]}
              onPress={() => setBrowseViewMode('list')}
            >
              <Text style={[styles.viewModeText, browseViewMode === 'list' && styles.viewModeTextActive]}>📋 Список</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, browseViewMode === 'map' && styles.viewModeButtonActive]}
              onPress={() => setBrowseViewMode('map')}
            >
              <Text style={[styles.viewModeText, browseViewMode === 'map' && styles.viewModeTextActive]}>🗺️ Карта</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.donateButton}
            onPress={() => openCreateRequest('offer')}
          >
            <Text style={styles.roleButtonText}>🎁 Что я готов отдать сейчас</Text>
          </TouchableOpacity>

          {loading && <Text>Загрузка...</Text>}
          {browseViewMode === 'list' && (
            <>
              {!loading && requests.length === 0 && (
                <Text style={styles.emptyText}>Рядом пока никто не просит о помощи</Text>
              )}

              {requests.map((r) => (
                <View key={r.id} style={styles.requestCard}>
                  <Text style={styles.requestTitle}>
                    {r.category === 'food' ? '🍲' : '👕'} {r.title}
                  </Text>
                  {r.description ? (
                    <Text style={styles.requestDesc}>{r.description}</Text>
                  ) : null}
                  {renderAddress(r)}
                  {renderPartnerBadge(r)}
                  <Text style={styles.requestMeta}>
                    {!r.is_partner && (
                      <Text onPress={() => openProfile(r.user_id)} style={{ textDecorationLine: 'underline' }}>
                        {r.user_name}
                      </Text>
                    )}
                    {!r.is_partner && ' · '}
                    {r.distance_km ? `${Number(r.distance_km).toFixed(1)} км` : ''}
                  </Text>

                  {respondedIds.includes(r.id) ? (
                    <>
                      <Text style={styles.respondedText}>✓ Вы откликнулись</Text>
                      {contacts[r.id] && (
                        <TouchableOpacity
                          style={[styles.helpButton, { backgroundColor: '#1E88E5' }]}
                          onPress={() => setContact(contacts[r.id])}>
                          <Text style={styles.helpButtonText}>Связаться</Text>
                        </TouchableOpacity>
                      )}
                      {r.status !== 'completed' && (
                        <TouchableOpacity
                          style={styles.helpButton}
                          onPress={() => {
                            setReviewToUserId(r.user_id);
                            completeRequest(r.id);
                          }}
                          disabled={loading}>
                          <Text style={styles.helpButtonText}>Помощь оказана</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.helpButton}
                        onPress={() => respondToRequest(r.id, r.title)}
                        disabled={loading}>
                        <Text style={styles.helpButtonText}>Помочь</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ marginTop: 6, alignItems: 'center' }}
                        onPress={() => confirmReport(r.id)}
                      >
                        <Text style={{ color: '#999', fontSize: 12 }}>⚠️ Пожаловаться</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))}
            </>
          )}
          {browseViewMode === 'map' && (
            <>
              <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                <TouchableOpacity
                  style={[styles.viewModeButton, mapCategoryFilter === 'all' && styles.viewModeButtonActive]}
                  onPress={() => setMapCategoryFilter('all')}>
                  <Text style={[styles.viewModeText, mapCategoryFilter === 'all' && styles.viewModeTextActive]}>Все</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewModeButton, mapCategoryFilter === 'food' && styles.viewModeButtonActive]}
                  onPress={() => setMapCategoryFilter('food')}>
                  <Text style={[styles.viewModeText, mapCategoryFilter === 'food' && styles.viewModeTextActive]}>🍲 Еда</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewModeButton, mapCategoryFilter === 'clothing' && styles.viewModeButtonActive]}
                  onPress={() => setMapCategoryFilter('clothing')}>
                  <Text style={[styles.viewModeText, mapCategoryFilter === 'clothing' && styles.viewModeTextActive]}>👕 Одежда</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 400, width: '100%', marginBottom: 16 }}>
                <WebView
                  ref={browseMapRef}
                  style={{ flex: 1 }}
                  source={{ html: browseHtml }}
                />
                <TouchableOpacity style={styles.locateButton} onPress={browseGoToMe}>
                  <Text style={styles.locateButtonText}>➤</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}>
            <Text style={styles.logoutButtonText}>Выйти</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={deleteAccount}>
            <Text style={styles.deleteButtonText}>Удалить аккаунт</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('role')}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      {step === 'partner' && (
        <ScrollView style={{ width: '100%' }}>
          <Text style={styles.question}>Партнёрство для кафе и ресторанов</Text>

          <View style={styles.partnerInfoBox}>
            <Text style={styles.partnerInfoTitle}>Что получает партнёр</Text>
            <Text style={styles.partnerInfoText}>⭐ Отметка «Партнёр Рядом» на ваших объявлениях</Text>
            <Text style={styles.partnerInfoText}>📍 Страница заведения с адресом и маршрутом</Text>
            <Text style={styles.partnerInfoText}>⬆️ Ваши объявления о раздаче еды — выше в списке</Text>
            <Text style={styles.partnerInfoText}>📣 Упоминание в наших Instagram и TikTok</Text>
            <Text style={[styles.partnerInfoText, { marginTop: 10, fontWeight: 'bold' }]}>
              Первый месяц — бесплатно, далее {PARTNER_PRICE} в месяц
            </Text>
          </View>

          {loading && <Text>Загрузка...</Text>}

          {!loading && partnerStatus === 'pending' && (
            <View style={styles.requestCard}>
              <Text style={styles.requestTitle}>⏳ Заявка на проверке</Text>
              <Text style={styles.requestDesc}>
                {venueName} · {venueAddress}
              </Text>
              <Text style={styles.requestMeta}>Мы подключим вас в течение дня.</Text>
            </View>
          )}

          {!loading && partnerStatus === 'active' && partnerInfo && (
            <View style={styles.requestCard}>
              <Text style={styles.requestTitle}>⭐ Вы партнёр Рядом</Text>
              <Text style={styles.requestDesc}>{partnerInfo.venue_name}</Text>
              <Text style={styles.requestMeta}>
                Действует до {new Date(partnerInfo.paid_until).toLocaleDateString('ru-RU')}
              </Text>
              <TouchableOpacity
                style={[styles.button, { marginTop: 12 }]}
                onPress={() => openCreateRequest('offer')}>
                <Text style={styles.buttonText}>🍲 Раздать еду сейчас</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.helpButton, { backgroundColor: '#888' }]} onPress={payPartner}>
                <Text style={styles.helpButtonText}>Продлить — оплатить через Kaspi</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && partnerStatus === 'expired' && partnerInfo && (
            <View style={styles.requestCard}>
              <Text style={styles.requestTitle}>Срок партнёрства истёк</Text>
              <Text style={styles.requestDesc}>
                Оплатите {PARTNER_PRICE}, чтобы вернуть отметку «Партнёр Рядом» и поднятие объявлений.
              </Text>
              <TouchableOpacity style={styles.helpButton} onPress={payPartner}>
                <Text style={styles.helpButtonText}>Оплатить через Kaspi</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && (partnerStatus === 'none' || partnerStatus === 'rejected') && (
            <>
              {partnerStatus === 'rejected' && (
                <Text style={styles.noResponseText}>
                  Предыдущая заявка не одобрена. Проверьте данные и отправьте снова.
                </Text>
              )}
              <TextInput
                style={styles.input}
                placeholder="Название заведения"
                value={venueName}
                onChangeText={setVenueName}
              />
              <TextInput
                style={styles.input}
                placeholder="Адрес"
                value={venueAddress}
                onChangeText={setVenueAddress}
              />
              <TextInput
                style={styles.input}
                placeholder="Часы работы (например, 10:00–22:00)"
                value={venueHours}
                onChangeText={setVenueHours}
              />
              <TextInput
                style={styles.input}
                placeholder="Телефон заведения"
                value={venuePhone}
                onChangeText={setVenuePhone}
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.mapButton} onPress={openPicker}>
                <Text style={styles.mapButtonText}>📍 Отметить заведение на карте</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { marginTop: 14 }]}
                onPress={applyPartner}
                disabled={loading}>
                <Text style={styles.buttonText}>Отправить заявку</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.backButton} onPress={() => setStep('role')}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={venueVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {venueData && (
              <>
                <Text style={styles.partnerBadgeText}>⭐ Партнёр Рядом</Text>
                <Text style={[styles.welcome, { textAlign: 'left', marginTop: 8 }]}>{venueData.venue_name}</Text>
                <Text style={styles.requestDesc}>📍 {venueData.address}</Text>
                {venueData.hours ? <Text style={styles.requestDesc}>🕒 {venueData.hours}</Text> : null}
                {venueData.phone ? (
                  <Text
                    style={[styles.requestDesc, { textDecorationLine: 'underline' }]}
                    onPress={() => Linking.openURL(`tel:${venueData.phone.replace(/[^+\d]/g, '')}`)}>
                    📞 {venueData.phone}
                  </Text>
                ) : null}
                <TouchableOpacity style={styles.helpButton} onPress={() => openDirections(venueData)}>
                  <Text style={styles.helpButtonText}>Как добраться</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={{ marginTop: 12, alignItems: 'center' }}
              onPress={() => setVenueVisible(false)}>
              <Text style={{ color: '#999' }}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {step === 'browseOffers' && (
        <ScrollView style={{ width: '100%' }}>
          <Text style={styles.question}>
            {cafesOnly ? '🍽 Кафе рядом раздают еду' : 'Что предлагают рядом'}
          </Text>
          <View style={styles.safetyBox}>
            <Text style={styles.safetyText}>
              🛡 Встречайтесь днём в людных местах. Помощь всегда бесплатна — не переводите деньги.
            </Text>
          </View>
          {loading && <Text>Загрузка...</Text>}
          {!loading && offers.filter((o) => !cafesOnly || o.is_partner).length === 0 && (
            <Text style={styles.emptyText}>
              {cafesOnly ? 'Сейчас кафе рядом ничего не раздают. Загляните позже!' : 'Пока никто ничего не предлагает'}
            </Text>
          )}

          {offers.filter((o) => !cafesOnly || o.is_partner).map((o) => (
            <View key={o.id} style={styles.requestCard}>
              <Text style={styles.requestTitle}>
                {o.category === 'food' ? '🍲' : '👕'} {o.title}
              </Text>
              {o.description ? (
                <Text style={styles.requestDesc}>{o.description}</Text>
              ) : null}
              {renderAddress(o)}
              {renderPartnerBadge(o)}
              <Text style={styles.requestMeta}>
                {!o.is_partner && (
                  <Text onPress={() => openProfile(o.user_id)} style={{ textDecorationLine: 'underline' }}>
                    {o.user_name}
                  </Text>
                )}
                {!o.is_partner && ' · '}
                {o.distance_km ? `${Number(o.distance_km).toFixed(1)} км` : ''}
              </Text>

              {respondedIds.includes(o.id) ? (
                <>
                  <Text style={styles.respondedText}>✓ Вы откликнулись</Text>
                  {contacts[o.id] && (
                    <TouchableOpacity
                      style={[styles.helpButton, { backgroundColor: '#1E88E5' }]}
                      onPress={() => setContact(contacts[o.id])}>
                      <Text style={styles.helpButtonText}>Связаться</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.helpButton}
                    onPress={() => respondToRequest(o.id, o.title)}
                    disabled={loading}>
                    <Text style={styles.helpButtonText}>Взять</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ marginTop: 6, alignItems: 'center' }}
                    onPress={() => confirmReport(o.id)}>
                    <Text style={{ color: '#999', fontSize: 12 }}>⚠️ Пожаловаться</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('neederChoice')}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cafesButton: {
    borderColor: '#F2C94C',
    backgroundColor: '#FFFBEA',
  },
  partnerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  partnerBadgeText: {
    color: '#8A6D00',
    fontSize: 13,
    fontWeight: '700',
  },
  partnerInfoBox: {
    width: '100%',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  partnerInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  partnerInfoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  safetyBox: {
    width: '100%',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  safetyText: {
    fontSize: 13,
    color: '#6D4C00',
    lineHeight: 18,
  },
  googleButton: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  appleButton: {
    width: '100%',
    height: 52,
    marginBottom: 12,
  },
  expiryHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  fieldHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 13,
    color: '#2E7D32',
    marginBottom: 6,
  },
  donateButton: {
    marginTop: 24,
    padding: 12,
    alignItems: 'center',
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  viewModeButtonActive: {
    backgroundColor: '#2E7D32',
  },
  viewModeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  viewModeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  donateButtonText: {
    color: '#B8860B',
    fontWeight: '600',
    fontSize: 15,
  },
  mapButton: {
    backgroundColor: '#eee',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  mapButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  mapHint: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 10,
    fontSize: 14,
    color: '#555',
    backgroundColor: '#fff',
  },
  locateButton: {
    position: 'absolute',
    right: 14,
    bottom: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  locateButtonText: {
    fontSize: 22,
    color: '#1E88E5',
  },
  contactRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#25D366',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  callButton: {
    flex: 1,
    backgroundColor: '#1E88E5',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 60,
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  welcome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
    textAlign: 'center',
  },
  question: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#2E7D32',
    fontSize: 15,
  },
  roleButton: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  roleButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  roleButtonSubtext: {
    fontSize: 14,
    color: '#888',
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  categoryButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  categoryButtonSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  categoryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  requestCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  requestDesc: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  requestMeta: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  helpButton: {
    marginTop: 10,
    backgroundColor: '#2E7D32',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  helpButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  logoutButton: {
    marginTop: 24,
    backgroundColor: '#999',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  deleteButton: {
    marginTop: 10,
    backgroundColor: '#D32F2F',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  respondedText: {
    marginTop: 10,
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: 13,
  },
  linkButton: {
    marginTop: 12,
    padding: 10,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#2E7D32',
    fontSize: 15,
    fontWeight: '600',
  },
  responseItem: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  responseText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  noResponseText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 6,
  },
});
