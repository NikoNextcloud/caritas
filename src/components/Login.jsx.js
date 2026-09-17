const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    console.log('Attempting login with:', email);
    await login(email, password);
    console.log('Login successful!');
  } catch (err) {
    console.error('Login error code:', err.code);
    console.error('Login error message:', err.message);
    
    if (err.code === 'auth/user-not-found') {
      setError('Няма такъв потребител');
    } else if (err.code === 'auth/wrong-password') {
      setError('Грешна парола');
    } else if (err.code === 'auth/invalid-email') {
      setError('Невалиден имейл');
    } else {
      setError('Грешка: ' + err.message);
    }
  }
};