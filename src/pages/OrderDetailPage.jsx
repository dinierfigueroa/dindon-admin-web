// src/pages/OrderDetailPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box, Breadcrumbs, Typography, Paper, Chip, Grid, Divider, Avatar,
  Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow,
  TableContainer, Stack, Skeleton, Alert, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select,
  FormControl, InputLabel
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalMallIcon from '@mui/icons-material/LocalMall';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import DoneIcon from '@mui/icons-material/Done';
import LocalDiningIcon from '@mui/icons-material/LocalDining';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';

import { db } from '../firebase/config';
import {
  doc, onSnapshot, updateDoc, Timestamp,
  collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, limit
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ===== Helpers =====
const currency = (n) =>
  typeof n === 'number'
    ? `L ${n.toFixed(2)}`
    : n
    ? `L ${Number(n).toFixed(2)}`
    : 'L 0.00';

const formatDateTime = (ts) => {
  if (!ts) return '-';
  const d =
    typeof ts?.toDate === 'function'
      ? ts.toDate()
      : typeof ts === 'number'
      ? new Date(ts)
      : ts instanceof Date
      ? ts
      : null;
  if (!d) return '-';
  return d.toLocaleString('es-HN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const EstadoChip = ({ estadoText, estadoBool }) => {
  const color =
    estadoText?.toLowerCase() === 'enviado'
      ? 'info'
      : estadoText?.toLowerCase() === 'confirmado'
      ? 'primary'
      : estadoText?.toLowerCase() === 'en proceso'
      ? 'warning'
      : estadoText?.toLowerCase() === 'en camino'
      ? 'secondary'
      : estadoText?.toLowerCase() === 'entregado'
      ? 'success'
      : estadoText?.toLowerCase() === 'cancelado'
      ? 'error'
      : estadoBool
      ? 'primary'
      : 'default';
  return <Chip label={estadoText || '—'} color={color} size="small" />;
};

const MetodoChip = ({ metodo }) => {
  const color =
    (metodo || '').toUpperCase() === 'TARJETA'
      ? 'primary'
      : (metodo || '').toUpperCase() === 'EFECTIVO'
      ? 'secondary'
      : 'default';
  return (
    <Chip
      icon={<CreditCardIcon />}
      label={metodo || '—'}
      color={color}
      variant="outlined"
      size="small"
    />
  );
};

const Badge = ({ label, value, icon }) => (
  <Stack direction="row" spacing={1} alignItems="center">
    {icon}
    <Typography variant="body2" color="text.secondary">
      {label}:
    </Typography>
    <Typography variant="body2" fontWeight={600}>
      {value ?? '—'}
    </Typography>
  </Stack>
);

function RowAmount({ label, value, strong = false, valueColor }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={strong ? 800 : 600} color={valueColor}>
        {value}
      </Typography>
    </Stack>
  );
}

// ===== Main Page =====
export default function OrderDetailPage() {
  const { id } = useParams(); // orders/{id}
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [editOpen, setEditOpen] = useState(false);
  const [itemsDraft, setItemsDraft] = useState([]);

  const [driversOpen, setDriversOpen] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [driverSel, setDriverSel] = useState('');
  const [pagoDriverLocal, setPagoDriverLocal] = useState('');

  // Búsqueda de productos en el diálogo de ítems
  const [prodSearch, setProdSearch] = useState('');
  const [prodResults, setProdResults] = useState([]);
  const [searchingProd, setSearchingProd] = useState(false);

  // Cloud Functions (para notificaciones)
  const functions = getFunctions();
  const sendStoreNotification = httpsCallable(functions, 'sendStoreNotification');
  const sendUserNotification  = httpsCallable(functions, 'sendUserNotification');

  // Load order realtime
  useEffect(() => {
    if (!id) return;
    const ref = doc(db, 'orders', id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setNotFound(true);
          setOrder(null);
        } else {
          const data = { id: snap.id, ...snap.data() };
          setOrder(data);
          setPagoDriverLocal(data?.pagoDriver ?? '');
          setNotFound(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error cargando orden:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  const items = useMemo(
    () => (Array.isArray(order?.itemsOrder) ? order.itemsOrder : []),
    [order]
  );
  const shippingAddress = order?.shippingAddress || {};
  const nombreCiudad = order?.nombreCiudad || '';

  // Totales y ganancia
  const subTotal = Number(order?.subTotal ?? 0);
  const shipping = Number(order?.shipping ?? 0);
  const serviceFee = Number(order?.serviceFee ?? 0);
  const priorityDelivery = Number(order?.priorityDelivery ?? 0);
  const tip = Number(order?.tip ?? 0);
  const discount = Number(order?.discount ?? 0);
  const totalApp = Number(order?.totalApp ?? 0);

  const costoPorItems = useMemo(() => {
    return items.reduce(
      (acc, it) => acc + Number(it?.subtotalItemCalculadoTienda ?? 0),
      0
    );
  }, [items]);

  const totalCosto = Number(
    order?.totalCosto != null ? order.totalCosto : costoPorItems
  );
  const ganancia = totalApp - totalCosto;

  // ===== Actions =====
  const updateOrder = async (payload) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'orders', id), payload);
    } catch (e) {
      console.error('Error al actualizar orden:', e);
      alert('No se pudo actualizar la orden.');
    } finally {
      setSaving(false);
    }
  };

  const confirmarPedido = async () => {
    await updateOrder({
      estadoText: 'Confirmado',
      horaConfirmado: Timestamp.now(),
    });
    try {
      await sendStoreNotification({
        orderId: id,
        title: 'Nuevo pedido',
        body: `Pedido #${order?.numeroDeOrden || ''} confirmado`,
      });
    } catch (e) {
      console.warn('No se pudo disparar la notificación a tienda:', e);
    }
  };

  const procesarPedido = async () => {
    await updateOrder({
      estadoText: 'En Proceso',
      horaEnProceso: Timestamp.now(),
    });
    try {
      const uidCliente = order?.userId || order?.userRef?.id || order?.uid;
      if (uidCliente) {
        await sendUserNotification({
          userId: uidCliente,
          title: 'Tu pedido está en proceso',
          body: `Pedido #${order?.numeroDeOrden || ''} está en preparación.`,
          dataPayload: { orderId: id, status: 'EN_PROCESO' },
        });
      }
    } catch (e) {
      console.warn('No se pudo notificar al cliente (en proceso):', e);
    }
  };

  const despacharPedido = async () => {
    await updateOrder({
      horaDespachado: Timestamp.now(),
    });
  };

  const marcarEnCamino = async () => {
    await updateOrder({
      estadoText: 'En Camino',
      horaEnCamino: Timestamp.now(),
    });
    try {
      const uidCliente = order?.userId || order?.userRef?.id || order?.uid;
      if (uidCliente) {
        await sendUserNotification({
          userId: uidCliente,
          title: 'Tu pedido va en camino',
          body: `Pedido #${order?.numeroDeOrden || ''} está en ruta.`,
          dataPayload: { orderId: id, status: 'EN_CAMINO' },
        });
      }
    } catch (e) {
      console.warn('No se pudo notificar al cliente (en camino):', e);
    }
  };

  const entregarPedido = async () => {
    await updateOrder({
      estadoText: 'Entregado',
      estadoBool: false,
      estadoFiltros: ['Todos', 'Entregados'],
      horaEntregado: Timestamp.now(),
    });
    try {
      const uidCliente = order?.userId || order?.userRef?.id || order?.uid;
      if (uidCliente) {
        await sendUserNotification({
          userId: uidCliente,
          title: 'Pedido entregado',
          body: `¡Gracias! Pedido #${order?.numeroDeOrden || ''} fue entregado.`,
          dataPayload: { orderId: id, status: 'ENTREGADO' },
        });
      }
    } catch (e) {
      console.warn('No se pudo notificar al cliente (entregado):', e);
    }
  };

  const cancelarPedido = async () => {
    if (order?.horaEntregado) {
      alert('Este pedido ya fue entregado; no se puede cancelar.');
      return;
    }
    await updateOrder({
      estadoText: 'Cancelado',
      estadoBool: false,
      estadoFiltros: ['Todos', 'Cancelados'],
      horaCancelado: Timestamp.now(),
    });
    try {
      const uidCliente = order?.userId || order?.userRef?.id || order?.uid;
      if (uidCliente) {
        await sendUserNotification({
          userId: uidCliente,
          title: 'Pedido cancelado',
          body: `Pedido #${order?.numeroDeOrden || ''} ha sido cancelado.`,
          dataPayload: { orderId: id, status: 'CANCELADO' },
        });
      }
    } catch (e) {
      console.warn('No se pudo notificar al cliente (cancelado):', e);
    }
  };

  // ===== Drivers =====
  const openDrivers = async () => {
    try {
      setDriversOpen(true);
      const q = query(
        collection(db, 'users'),
        where('ciudad', '==', nombreCiudad),
        where('estado_driver', '==', true),
        where('es_repartidor', '==', true),
        where('activo', '==', true),
        orderBy('display_name', 'asc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDrivers(list);
      if (order?.driverId) setDriverSel(order.driverId);
    } catch (e) {
      console.error('Error cargando drivers:', e);
      alert('No se pudieron cargar los repartidores.');
    }
  };

  const assignDriver = async () => {
    const driver = drivers.find((d) => d.id === driverSel);
    if (!driver) {
      alert('Selecciona un repartidor.');
      return;
    }

    // Referencia al usuario repartidor
    const driverRef = doc(db, 'users', driver.id);

    await updateOrder({
      driverId: driver.id,
      driverName: driver.display_name || driver.displayName || driver.name || driver.nombre || driver.email || 'Driver',
      driverCity: driver.ciudad || nombreCiudad,
      asignadoRepartidor: true,
      idUserRepartidor: driverRef, // DocumentReference<users>
    });

    // Notificación al repartidor
    try {
      await sendUserNotification({
        userId: driver.id,
        title: 'Nueva entrega asignada',
        body: `Te asignaron el pedido #${order?.numeroDeOrden || ''}`,
        dataPayload: { orderId: id, role: 'driver', status: 'ASIGNADO' },
      });
    } catch (e) {
      console.warn('No se pudo notificar al repartidor:', e);
    }

    setDriversOpen(false);
  };

  // ===== Edit items =====
  const openEditItems = () => {
    const draft = (Array.isArray(order?.itemsOrder) ? order.itemsOrder : []).map((it) => ({
      nombreProducto: it?.nombreProducto || '',
      cantidad: Number(it?.cantidad ?? 1),
      precioUnitarioCalculadoApp: Number(it?.precioUnitarioCalculadoApp ?? 0),
      subtotalItemCalculadoApp: Number(it?.subtotalItemCalculadoApp ?? 0),
      precioUnitarioCalculadoTienda: Number(it?.precioUnitarioCalculadoTienda ?? 0),
      subtotalItemCalculadoTienda: Number(it?.subtotalItemCalculadoTienda ?? 0),
      imagenProductoUrl: it?.imagenProductoUrl || '',
      modificadoresSeleccionados: it?.modificadoresSeleccionados || [],
      extrasSeleccionados: it?.extrasSeleccionados || [],
      notasItem: it?.notasItem || '',
    }));
    setItemsDraft(draft);
    // limpiar búsqueda al abrir
    setProdSearch('');
    setProdResults([]);
    setEditOpen(true);
  };

  const addDraftItem = () => {
    setItemsDraft((prev) => [
      ...prev,
      {
        nombreProducto: '',
        cantidad: 1,
        precioUnitarioCalculadoApp: 0,
        subtotalItemCalculadoApp: 0,
        precioUnitarioCalculadoTienda: 0,
        subtotalItemCalculadoTienda: 0,
        imagenProductoUrl: '',
        modificadoresSeleccionados: [],
        extrasSeleccionados: [],
        notasItem: '',
      },
    ]);
  };

  const changeDraft = (idx, field, value) => {
    setItemsDraft((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      if (['cantidad', 'precioUnitarioCalculadoApp', 'precioUnitarioCalculadoTienda'].includes(field)) {
        const c = Number(copy[idx].cantidad || 0);
        const pA = Number(copy[idx].precioUnitarioCalculadoApp || 0);
        const pT = Number(copy[idx].precioUnitarioCalculadoTienda || 0);
        copy[idx].subtotalItemCalculadoApp = pA * c;
        copy[idx].subtotalItemCalculadoTienda = pT * c;
      }
      return copy;
    });
  };

  const saveItems = async () => {
    const newSubApp = itemsDraft.reduce((acc, it) => acc + Number(it.subtotalItemCalculadoApp || 0), 0);
    const newCosto = itemsDraft.reduce((acc, it) => acc + Number(it.subtotalItemCalculadoTienda || 0), 0);
    const newTotalApp = newSubApp + shipping + serviceFee + priorityDelivery + tip - discount;

    await updateOrder({
      itemsOrder: itemsDraft,
      subTotal: newSubApp,
      totalCosto: newCosto,
      totalApp: newTotalApp,
    });
    setEditOpen(false);
  };

  const savePagoDriver = async () => {
    const n = Number(pagoDriverLocal);
    const value = Number.isFinite(n) ? n : (pagoDriverLocal ?? '');
    await updateOrder({ pagoDriver: value });
    alert('Pago al driver guardado');
  };

  // ===== Product search (tienda): name prefix + searchKeywords =====
  const searchProducts = async () => {
    const termRaw = (prodSearch || '').trim();
    setProdResults([]);
    if (termRaw.length < 6) return;

    const term = termRaw.toLowerCase();
    const tiendaIdText = order?.tiendaIdText || '';

    try {
      setSearchingProd(true);

      // a) Prefijo por name (ordenado)
      const qName = query(
        collection(db, 'productos'),
        where('uuidEmpresa', '==', tiendaIdText),
        orderBy('name'),
        where('name', '>=', termRaw),
        where('name', '<=', termRaw + '\uf8ff'),
        limit(20)
      );

      // b) searchKeywords (array-contains) en minúsculas
      const qKW = query(
        collection(db, 'productos'),
        where('uuidEmpresa', '==', tiendaIdText),
        where('searchKeywords', 'array-contains', term),
        limit(20)
      );

      const [snapA, snapB] = await Promise.all([getDocs(qName), getDocs(qKW)]);
      const rowsA = snapA.docs.map(d => ({ id: d.id, ...d.data() }));
      const rowsB = snapB.docs.map(d => ({ id: d.id, ...d.data() }));

      // combinar únicos por id
      const map = new Map();
      [...rowsA, ...rowsB].forEach(p => map.set(p.id, p));
      const combined = Array.from(map.values()).slice(0, 20);

      setProdResults(combined);
    } catch (e) {
      console.error('Error buscando productos:', e);
      alert('No se pudo buscar productos (revisa índices compuestos en Firestore).');
    } finally {
      setSearchingProd(false);
    }
  };

  const addItemFromProduct = (p) => {
    const priceBase = Number(p?.price ?? 0);
    const priceSale = Number(p?.sale_price ?? 0);
    const precioApp = priceSale > 0 ? priceSale : priceBase;
    const precioTienda = priceBase;

    const nuevo = {
      nombreProducto: p?.name || '',
      cantidad: 1,
      precioUnitarioCalculadoApp: precioApp,
      subtotalItemCalculadoApp: precioApp * 1,
      precioUnitarioCalculadoTienda: precioTienda,
      subtotalItemCalculadoTienda: precioTienda * 1,
      imagenProductoUrl: p?.Imagen || '',
      modificadoresSeleccionados: [],
      extrasSeleccionados: [],
      notasItem: '',
    };

    setItemsDraft(prev => [...prev, nuevo]);
  };

  // ===== Visibility logic for buttons =====
  const canConfirm   = !order?.horaConfirmado;
  const canProcess   = !!order?.horaConfirmado && !order?.horaEnProceso;
  const canDispatch  = !!order?.horaEnProceso && !order?.horaDespachado;
  const canGoOnRoad  = !!order?.horaDespachado && !order?.horaEnCamino && !order?.horaEntregado && !order?.horaCancelado;
  const canDeliver   = !!order?.horaDespachado && !order?.horaEntregado && !order?.horaCancelado;
  const canCancel    = !order?.horaEntregado;

  // ===== Render =====
  if (loading) {
    return (
      <Box p={2}>
        <Skeleton variant="rectangular" height={120} />
      </Box>
    );
  }

  if (notFound || !order) {
    return (
      <Box p={2}>
        <Alert severity="warning">No se encontró la orden solicitada.</Alert>
      </Box>
    );
  }

  return (
    <Box p={2}>
      {/* Breadcrumbs */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link to="/ordenes" style={{ textDecoration: 'none' }}>
          <Typography color="text.secondary">Órdenes</Typography>
        </Link>
        <Typography color="text.primary">Detalle</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Avatar variant="rounded"><LocalMallIcon /></Avatar>
          </Grid>
          <Grid item xs={12} sm="auto">
            <Typography variant="h6" fontWeight={700}>
              Orden #{order?.numeroDeOrden ?? '—'}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <EstadoChip estadoText={order?.estadoText} estadoBool={order?.estadoBool} />
              <MetodoChip metodo={order?.metodoDePago} />
              <Chip label={order?.nombreCiudad || '—'} size="small" variant="outlined" />
            </Stack>
          </Grid>
          <Grid item xs />
          <Grid item>
            <Stack spacing={0.5} alignItems="flex-end">
              <Typography variant="body2" color="text.secondary">Creada:</Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatDateTime(order?.createdAt)}
              </Typography>
              <Typography variant="caption" color="text.secondary">ID doc: {order?.id}</Typography>
              {order?.idOrderText && (
                <Typography variant="caption" color="text.secondary">
                  Payment UUID: {order?.idOrderText}
                </Typography>
              )}
            </Stack>
          </Grid>
        </Grid>

        {/* Action buttons */}
        <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
          {canConfirm && (
            <Button onClick={confirmarPedido} variant="contained" startIcon={<DoneIcon />} disabled={saving}>
              Confirmar pedido
            </Button>
          )}
          {canProcess && (
            <Button onClick={procesarPedido} variant="outlined" startIcon={<LocalDiningIcon />} disabled={saving}>
              Procesar pedido
            </Button>
          )}
          {canDispatch && (
            <Button onClick={despacharPedido} variant="outlined" startIcon={<SendIcon />} disabled={saving}>
              Despachar pedido
            </Button>
          )}
          {canGoOnRoad && (
            <Button onClick={marcarEnCamino} variant="outlined" startIcon={<DirectionsBikeIcon />} disabled={saving}>
              En Camino
            </Button>
          )}
          {canDeliver && (
            <Button onClick={entregarPedido} color="success" variant="contained" startIcon={<CheckCircleIcon />} disabled={saving}>
              Entregar pedido
            </Button>
          )}
          {canCancel && (
            <Button onClick={cancelarPedido} color="error" variant="outlined" startIcon={<CancelIcon />} disabled={saving}>
              Cancelar pedido
            </Button>
          )}
          <Button onClick={openDrivers} variant="outlined" startIcon={<AssignmentIndIcon />} disabled={saving}>
            Asignar repartidor
          </Button>
          <Button onClick={openEditItems} variant="text" startIcon={<EditIcon />} disabled={saving}>
            Editar ítems
          </Button>
        </Stack>
      </Paper>

      {/* Top info cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                <StorefrontIcon />
                <Typography variant="subtitle1" fontWeight={700}>Negocio</Typography>
              </Stack>
              <Stack spacing={1}>
                <Badge
                  label="Nombre"
                  value={order?.nombreEmpresa}
                  icon={<Avatar sx={{ width: 20, height: 20 }} src={order?.logoEmpresa} />}
                />
                <Badge label="UUID Empresa" value={order?.tiendaIdText} icon={<></>} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                <PersonIcon />
                <Typography variant="subtitle1" fontWeight={700}>Cliente</Typography>
              </Stack>
              <Stack spacing={1}>
                <Badge label="Nombre" value={order?.nameCliente} icon={<></>} />
                <Badge label="Teléfono" value={order?.telefonoPrincipal} icon={<></>} />
                {order?.discountCoupon && (<Badge label="Cupón" value={order?.discountCoupon} icon={<></>} />)}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                <LocalShippingIcon />
                <Typography variant="subtitle1" fontWeight={700}>Entrega & Pago</Typography>
              </Stack>
              <Stack spacing={1}>
                <Badge label="Entrega" value={order?.formaDeEntrega} icon={<></>} />
                <Badge label="Método de pago" value={order?.metodoDePago} icon={<CreditCardIcon fontSize="small" />} />
                {order?.tarjetaUsada && (<Typography variant="body2">Tarjeta: **** **** **** {order?.tarjetaUsada}</Typography>)}
                {order?.conEntregaPrioritaria && <Chip size="small" color="warning" label="Entrega prioritaria" />}
                {order?.note && <Typography variant="body2"><strong>Nota:</strong> {order?.note}</Typography>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dirección */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Dirección de {order?.formaDeEntrega === 'Domicilio' ? 'envío' : 'recogido'}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Stack spacing={0.5}>
              <Typography variant="body2"><strong>Alias:</strong> {shippingAddress?.alias || '—'}</Typography>
              <Typography variant="body2"><strong>Ciudad:</strong> {shippingAddress?.ciudad || order?.nombreCiudad || '—'}</Typography>
              <Typography variant="body2"><strong>Dirección:</strong> {shippingAddress?.fullAddress || '—'}</Typography>
              {shippingAddress?.colonia && <Typography variant="body2"><strong>Colonia:</strong> {shippingAddress.colonia}</Typography>}
              {shippingAddress?.telefono && <Typography variant="body2"><strong>Teléfono:</strong> {shippingAddress.telefono}</Typography>}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Ítems */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={700}>Ítems del pedido</Typography>
          <Chip size="small" label={`${items.length} ítem(s)`} />
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell> </TableCell>
                <TableCell>Cant.</TableCell>
                <TableCell>Producto</TableCell>
                <TableCell>Precio (App)</TableCell>
                <TableCell>Subtotal (App)</TableCell>
                <TableCell align="right">Precio (Tienda)</TableCell>
                <TableCell align="right">Subtotal (Tienda)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell width={56}>
                    <Avatar
                      variant="rounded"
                      src={it?.imagenProductoUrl || ''}
                      alt={it?.nombreProducto || 'producto'}
                      sx={{ width: 40, height: 40 }}
                    />
                  </TableCell>
                  <TableCell>{it?.cantidad ?? 1}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" fontWeight={600}>{it?.nombreProducto || '—'}</Typography>
                      {!!(it?.modificadoresSeleccionados?.length) && (
                        <Typography variant="caption" color="text.secondary">
                          Modificadores: {it.modificadoresSeleccionados.map((m) => m?.nombre || m).join(', ')}
                        </Typography>
                      )}
                      {!!(it?.extrasSeleccionados?.length) && (
                        <Typography variant="caption" color="text.secondary">
                          Extras: {it.extrasSeleccionados.map((e) => e?.nombre || e).join(', ')}
                        </Typography>
                      )}
                      {it?.notasItem && (<Typography variant="caption" color="text.secondary">Nota: {it.notasItem}</Typography>)}
                    </Stack>
                  </TableCell>
                  <TableCell>{currency(it?.precioUnitarioCalculadoApp ?? 0)}</TableCell>
                  <TableCell>{currency(it?.subtotalItemCalculadoApp ?? 0)}</TableCell>
                  <TableCell align="right">{currency(it?.precioUnitarioCalculadoTienda ?? 0)}</TableCell>
                  <TableCell align="right">{currency(it?.subtotalItemCalculadoTienda ?? 0)}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary">No hay ítems en este pedido.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Totales + Ganancia + pagoDriver */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Resumen de pago</Typography>
            <Stack spacing={0.75} maxWidth={420}>
              <RowAmount label="Subtotal" value={currency(subTotal)} />
              <RowAmount label="Envío" value={currency(shipping)} />
              <RowAmount label="Service fee" value={currency(serviceFee)} />
              {order?.conEntregaPrioritaria && <RowAmount label="Entrega prioritaria" value={currency(priorityDelivery)} />}
              {tip > 0 && <RowAmount label="Propina" value={currency(tip)} />}
              {discount > 0 && <RowAmount label="Descuento" value={`- ${currency(discount)}`} valueColor="error.main" />}
              <Divider sx={{ my: 1 }} />
              <RowAmount label="Total" value={currency(totalApp)} strong />
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Administrativo</Typography>
            <Stack spacing={1} maxWidth={420}>
              <RowAmount label="Costo productos (tienda)" value={currency(totalCosto)} />
              <RowAmount label="Ganancia (Total - Costo)" value={currency(ganancia)} strong />
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Pago al driver (L)"
                  size="small"
                  value={pagoDriverLocal}
                  onChange={(e) => setPagoDriverLocal(e.target.value)}
                  fullWidth
                  inputMode="decimal"
                />
                <Button onClick={savePagoDriver} variant="contained" disabled={saving}>
                  Guardar
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {!!(order?.estadoFiltros?.length) && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Filtros de estado</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {order.estadoFiltros.map((e, i) => (
              <Chip key={`${e}-${i}`} size="small" label={String(e)} />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Dialog: Editar ítems */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Editar ítems</DialogTitle>
        <DialogContent dividers>

          {/* Búsqueda de productos de la tienda */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Agregar desde productos de la tienda (mín. 6 letras)
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                fullWidth
                size="small"
                label="Buscar producto por nombre"
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder="Escribe al menos 6 letras"
              />
              <Button variant="outlined" onClick={searchProducts} disabled={searchingProd}>
                {searchingProd ? 'Buscando...' : 'Buscar'}
              </Button>
            </Stack>

            {/* Resultados */}
            {prodSearch.length >= 6 && (
              <Paper variant="outlined" sx={{ mt: 1, maxHeight: 220, overflow: 'auto' }}>
                {prodResults.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                    {searchingProd ? 'Buscando…' : 'Sin resultados.'}
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Imagen</TableCell>
                        <TableCell>Producto</TableCell>
                        <TableCell>Precio</TableCell>
                        <TableCell>Precio oferta</TableCell>
                        <TableCell width={120} align="right">Añadir</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {prodResults.map(p => (
                        <TableRow key={p.id} hover>
                          <TableCell width={56}>
                            <Avatar variant="rounded" src={p?.Imagen || ''} sx={{ width: 40, height: 40 }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{p?.name || '-'}</Typography>
                            {!!p?.description && (
                              <Typography variant="caption" color="text.secondary">
                                {String(p.description).slice(0, 80)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>L {Number(p?.price ?? 0).toFixed(2)}</TableCell>
                          <TableCell>
                            {Number(p?.sale_price ?? 0) > 0 ? `L ${Number(p.sale_price).toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="contained" onClick={() => addItemFromProduct(p)}>
                              Agregar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            )}
          </Box>

          {/* Tabla para edición manual */}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell>Cant.</TableCell>
                <TableCell>Precio (App)</TableCell>
                <TableCell>Subtotal (App)</TableCell>
                <TableCell>Precio (Tienda)</TableCell>
                <TableCell>Subtotal (Tienda)</TableCell>
                <TableCell>Imagen URL</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itemsDraft.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField
                      value={it.nombreProducto}
                      onChange={(e) => changeDraft(idx, 'nombreProducto', e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell width={90}>
                    <TextField
                      value={it.cantidad}
                      onChange={(e) => changeDraft(idx, 'cantidad', Number(e.target.value || 0))}
                      size="small"
                      type="number"
                      inputProps={{ min: 0 }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell width={140}>
                    <TextField
                      value={it.precioUnitarioCalculadoApp}
                      onChange={(e) => changeDraft(idx, 'precioUnitarioCalculadoApp', Number(e.target.value || 0))}
                      size="small"
                      type="number"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell width={140}>
                    <TextField
                      value={it.subtotalItemCalculadoApp}
                      size="small"
                      InputProps={{ readOnly: true }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell width={140}>
                    <TextField
                      value={it.precioUnitarioCalculadoTienda}
                      onChange={(e) => changeDraft(idx, 'precioUnitarioCalculadoTienda', Number(e.target.value || 0))}
                      size="small"
                      type="number"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell width={140}>
                    <TextField
                      value={it.subtotalItemCalculadoTienda}
                      size="small"
                      InputProps={{ readOnly: true }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={it.imagenProductoUrl}
                      onChange={(e) => changeDraft(idx, 'imagenProductoUrl', e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button onClick={addDraftItem} startIcon={<AddIcon />} sx={{ mt: 1 }}>
            Añadir ítem
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveItems} disabled={saving}>
            Guardar cambios
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Asignar repartidor */}
      <Dialog open={driversOpen} onClose={() => setDriversOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar repartidor ({nombreCiudad})</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth>
            <InputLabel>Repartidor</InputLabel>
            <Select
              label="Repartidor"
              value={driverSel}
              onChange={(e) => setDriverSel(e.target.value)}
            >
              {drivers.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.display_name || d.displayName || d.name || d.nombre || d.email || d.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDriversOpen(false)}>Cerrar</Button>
          <Button onClick={assignDriver} variant="contained" disabled={saving}>
            Asignar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}