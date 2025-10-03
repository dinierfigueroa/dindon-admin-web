import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Typography, Box, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Grid, TextField, Button, IconButton,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import newOrderSound from '../assets/new_order_sound.mp3';

const orderStatuses = ['Enviado', 'Confirmado', 'En Proceso', 'En Camino', 'Entregado', 'Cancelado'];

const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(searchParams.get('inicio') || getTodayString());
  const [endDate, setEndDate] = useState(searchParams.get('fin') || getTodayString());
  const [statusFilter, setStatusFilter] = useState(searchParams.get('estado') || 'Enviado');
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orden') || '');
  const [cityFilter, setCityFilter] = useState(searchParams.get('ciudad') || 'JUTICALPA');
  const [cities, setCities] = useState(['JUTICALPA']);

  const audioPlayer = useRef(new Audio(newOrderSound));
  const navigate = useNavigate();

  useEffect(() => {
    const audio = audioPlayer.current;
    audio.loop = true;
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'cities'), orderBy('nombreCiudad', 'asc')));
        const list = snap.docs.map(d => d.data().nombreCiudad).filter(Boolean);
        if (list.length) setCities(list);
      } catch (e) {
        console.warn('No se pudieron cargar ciudades:', e);
      }
    })();
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setOrders([]);
    audioPlayer.current.pause();
    audioPlayer.current.currentTime = 0;

    try {
      let queries = [collection(db, 'orders')];

      if (orderNumber) {
        queries.push(where('numeroDeOrden', '==', orderNumber.trim()));
        queries.push(orderBy('createdAt', 'desc'));
        const onlyOrderQuery = query(...queries);
        const qs = await getDocs(onlyOrderQuery);
        const data = qs.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        setOrders(data);
        if (statusFilter === 'Enviado' && data.length > 0) {
          audioPlayer.current.play().catch(e => console.warn('Audio bloqueado por el navegador:', e));
        }
        setLoading(false);
        return;
      }

      if (statusFilter) queries.push(where('estadoText', '==', statusFilter));
      if (startDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        queries.push(where('createdAt', '>=', Timestamp.fromDate(startOfDay)));
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        queries.push(where('createdAt', '<=', Timestamp.fromDate(endOfDay)));
      }
      if (cityFilter) queries.push(where('nombreCiudad', '==', cityFilter));

      queries.push(orderBy('createdAt', 'desc'));

      const ordersQuery = query(...queries);
      const querySnapshot = await getDocs(ordersQuery);
      const ordersData = querySnapshot.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data(),
      }));
      setOrders(ordersData);

      if (statusFilter === 'Enviado' && ordersData.length > 0) {
        audioPlayer.current.play().catch(e => console.warn('Audio bloqueado por el navegador:', e));
      }
    } catch (error) {
      console.error('Error al obtener las órdenes: ', error);
      alert('Hubo un error al buscar las órdenes. Es posible que necesites crear un índice en Firestore. Revisa la consola para ver el enlace.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, startDate, endDate, orderNumber, cityFilter]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (startDate) params.set('inicio', startDate);
    if (endDate) params.set('fin', endDate);
    if (orderNumber) params.set('orden', orderNumber);
    if (cityFilter) params.set('ciudad', cityFilter);
    setSearchParams(params, { replace: true });
  }, [statusFilter, startDate, endDate, orderNumber, cityFilter, setSearchParams]);

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Historial de Pedidos
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Búsqueda Avanzada</Typography>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={3}>
            <TextField
              label="Fecha de inicio"
              type="date"
              fullWidth
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Fecha de fin"
              type="date"
              fullWidth
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select
                value={statusFilter}
                label="Estado"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value=""><em>Todos</em></MenuItem>
                {orderStatuses.map(status => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>Ciudad</InputLabel>
              <Select
                value={cityFilter}
                label="Ciudad"
                onChange={(e) => setCityFilter(e.target.value)}
              >
                {cities.map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <TextField
              label="No. de Orden"
              fullWidth
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={12} md={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={fetchOrders}
              startIcon={<SearchIcon />}
            >
              Buscar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>No. Orden</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Negocio</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : orders.length > 0 ? (
              orders.map(order => (
                <TableRow key={order.firestoreId} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell>{order.numeroDeOrden}</TableCell>
                  <TableCell>{order.nameCliente}</TableCell>
                  <TableCell>{order.nombreEmpresa}</TableCell>
                  <TableCell>L {Number(order.totalApp || 0).toFixed(2)}</TableCell>
                  <TableCell>{order.createdAt?.toDate().toLocaleString('es-HN') || 'N/A'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      color="primary"
                      title="Ver Detalles"
                      onClick={() => navigate(`/ordenes/${order.firestoreId}`)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No se encontraron órdenes con los filtros actuales.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default OrdersPage;