import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
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
} from 'react-native';


import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';

const API_URL = 'https://ryadom-backend-production.up.railway.app';

export default function App() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // phone, code, role, createRequest, browseRequests
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');

  const [category, setCategory] = useState('food');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [requests, setRequests] = useState([]);
  const [respondedIds, setRespondedIds] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [userLat, setUserLat] = useState(47.1164);
  const [userLng, setUserLng] = useState(51.9126);
  const [mapVisible, setMapVisible] = useState(false);
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
  Linking.openURL('https://pay.kaspi.kz/pay/y0lpmrri');
};

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Геолокация',
          'Без доступа к геолокации будут показаны примерные координаты (Атырау)'
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setUserLat(loc.coords.latitude);
      setUserLng(loc.coords.longitude);
    } catch (e) {
      console.log('Location error:', e.message);
    }
  };

  useEffect(() => {
    getUserLocation();
  }, []);
  const sendOtp = async () => {
    if (!phone) {
      Alert.alert('Ошибка', 'Введите номер телефона');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('code');
        Alert.alert(
          'Код отправлен',
          'Проверьте SMS (или логи Railway в тестовом режиме)'
        );
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось отправить код');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, name: 'Пользователь' }),
      });
      const data = await res.json();
      if (data.success) {
        setUserId(data.user.id);
        setUserName(data.user.name);
        setStep('role');
      } else {
        Alert.alert('Ошибка', data.error || 'Неверный код');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const selectRole = (selectedRole) => {
    if (selectedRole === 'needer') {
      setStep('createRequest');
    } else {
      loadRequests();
      setStep('browseRequests');
    }
  };

  const createRequest = async () => {
    if (!title) {
      Alert.alert('Ошибка', 'Введите заголовок запроса');
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
          lat: userLat,
          lng: userLng,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Готово!', 'Ваш запрос опубликован');
        setTitle('');
        setDescription('');
        setStep('role');
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось создать запрос');
      }
    } catch (e) {
      Alert.alert('Ошибка сети', e.message);
    }
    setLoading(false);
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/requests?lat=${userLat}&lng=${userLng}`
      );

      const data = await res.json();
      setRequests(data.requests || []);
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

  const respondToRequest = async (requestId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helper_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        const phone = data.requester?.phone || 'не указан';
        Alert.alert(
          'Вы откликнулись!',
          `Свяжитесь с ${
            data.requester?.name || 'человеком'
          } по телефону: ${phone}`
        );
        setRespondedIds([...respondedIds, requestId]);
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








  return (
    <View style={styles.container}>
      <Text style={styles.title}>Рядом</Text>
      <Text style={styles.subtitle}>Помогаем соседям</Text>

      {step === 'phone' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="+7 700 000 00 00"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            style={styles.button}
            onPress={sendOtp}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? 'Отправка...' : 'Получить код'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'code' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Код из SMS"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={styles.button}
            onPress={verifyOtp}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? 'Проверка...' : 'Войти'}
            </Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.donateButton} onPress={donate}>
  <Text style={styles.donateButtonText}>💛 Помощь проекту</Text>
</TouchableOpacity>
        </>
      )}

      {step === 'createRequest' && (
        <ScrollView style={{ width: '100%' }}>
          <Text style={styles.question}>Что вам нужно?</Text>

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
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => setMapVisible(true)}>
            <Text style={styles.mapButtonText}>📍 Уточнить место на карте</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={createRequest}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? 'Публикация...' : 'Опубликовать запрос'}
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
      <Modal visible={mapVisible} animationType="slide"><View style={{flex:1}}><WebView style={{flex:1}} source={{html:`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>#map{height:100vh;width:100vw;margin:0;padding:0;}</style></head><body style="margin:0;padding:0;"><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var map=L.map('map').setView([${userLat},${userLng}],14);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);var marker=L.marker([${userLat},${userLng}],{draggable:true}).addTo(map);function sendCoords(lat,lng){window.ReactNativeWebView.postMessage(JSON.stringify({lat:lat,lng:lng}));}marker.on('dragend',function(e){var pos=marker.getLatLng();sendCoords(pos.lat,pos.lng);});map.on('click',function(e){marker.setLatLng(e.latlng);sendCoords(e.latlng.lat,e.latlng.lng);});</script></body></html>`}} onMessage={(event)=>{const data=JSON.parse(event.nativeEvent.data);setUserLat(data.lat);setUserLng(data.lng);}} /><TouchableOpacity style={[styles.button,{margin:16}]} onPress={()=>setMapVisible(false)}><Text style={styles.buttonText}>Готово</Text></TouchableOpacity></View></Modal>
      <Modal visible={reviewModalVisible} animationType="slide" transparent={true}>
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20 }}>
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
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, maxHeight: '80%' }}>
      {profileData && (
        <>
          <Text style={styles.question}>{profileData.name}</Text>
          <Text style={{ color: '#666', marginBottom: 8 }}>{profileData.phone}</Text>
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

              {r.responses && r.responses.length > 0 ? (
                r.responses.map((resp) => (
                  <View key={resp.id} style={styles.responseItem}>
                    <Text style={styles.responseText}>
                      🧑 <Text onPress={() => openProfile(resp.helper_id)} style={{ textDecorationLine: 'underline' }}>{resp.helper_name}</Text> · {resp.helper_phone}

                    </Text>
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
            style={styles.backButton}
            onPress={() => setStep('createRequest')}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'browseRequests' && (
        <ScrollView style={{ width: '100%' }}>
          <Text style={styles.question}>Кто рядом нуждается в помощи?</Text>
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




          {loading && <Text>Загрузка...</Text>}
          {browseViewMode === 'list' && (
  <>
  {!loading && requests.length === 0 && (
    <Text style={styles.emptyText}>Активных запросов пока нет</Text>
  )}

  {requests.map((r) => (
    <View key={r.id} style={styles.requestCard}>
      <Text style={styles.requestTitle}>
        {r.category === 'food' ? '🍲' : '👕'} {r.title}
      </Text>
      {r.description ? (
        <Text style={styles.requestDesc}>{r.description}</Text>
      ) : null}
      <Text style={styles.requestMeta}>
  <Text onPress={() => openProfile(r.user_id)} style={{ textDecorationLine: 'underline' }}>
    {r.user_name}
  </Text>
  {' · '}
  {r.distance_km ? `${r.distance_km.toFixed(1)} км` : ''}
</Text>



      {respondedIds.includes(r.id) ? (
       <>
  <Text style={styles.respondedText}>✓ Вы откликнулись</Text>
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
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => respondToRequest(r.id)}
          disabled={loading}>
          <Text style={styles.helpButtonText}>Помочь</Text>
        </TouchableOpacity>
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
    style={[styles.viewModeButton, mapCategoryFilter === 'clothes' && styles.viewModeButtonActive]}
    onPress={() => setMapCategoryFilter('clothes')}>
    <Text style={[styles.viewModeText, mapCategoryFilter === 'clothes' && styles.viewModeTextActive]}>👕 Одежда</Text>
  </TouchableOpacity>
</View>
  )}          
  <View style={{ height: 400, width: '100%', marginBottom: 16 }}>
    <WebView
      style={{ flex: 1 }}
      source={{
        html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>#map{height:100vh;width:100vw;margin:0;padding:0;}</style></head><body style="margin:0;padding:0;"><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>var map=L.map('map').setView([${userLat},${userLng}],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);L.marker([${userLat},${userLng}]).addTo(map).bindPopup('Вы здесь');${requests.filter(r => mapCategoryFilter === 'all' || r.category === mapCategoryFilter).map(r =>
 `L.marker([${r.lat},${r.lng}]).addTo(map).bindPopup(${JSON.stringify(r.title)});`).join('')}</script></body></html>`
      }}
    />
  </View>
  </>
)}


          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('role')}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  donateButton: {
  marginTop: 24,
  padding: 12,
  alignItems: 'center',
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
