// src/pages/OrderDetailPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box,
  Breadcrumbs,
  Typography,
  Paper,
  Chip,
  Grid,
  Divider,
  Avatar,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Stack,
  Skeleton,
  Alert,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalMallIcon from '@mui/icons-material/LocalMall';

import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

// --- Helpers ---
const currency = (n) =>
  typeof n === 'number'
    ? `L ${n.toFixed(2)}`
    : n
    ? `L ${Number(n).toFixed(2)}`
    : 'L 0.00';

const formatDateTime = (ts) => {
  if (!ts) return '-';
  // ts puede ser Timestamp de Firestore o Date/number
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
      : estadoText?.toLowerCase() === 'preparando'
      ? 'warning'
      : estadoText?.toLowerCase() === 'en camino'
      ? 'secondary'
      : estadoText?.toLowerCase() === 'entregado'
      ? 'success'
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

// --- Main Page ---
export default function OrderDetailPage() {
  const { id } = useParams(); // ID del documento en Firestore (orders/{id})
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
          setOrder({ id: snap.id, ...snap.data() });
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

  const items = useMemo(() => order?.itemsOrder || [], [order]);
  const shippingAddress = order?.shippingAddress || {};
  const datosRTN = order?.datosRTN || {};

  // Totales con fallback por si vienen como string
  const subTotal = Number(order?.subTotal ?? 0);
  const shipping = Number(order?.shipping ?? 0);
  const serviceFee = Number(order?.serviceFee ?? 0);
  const priorityDelivery = Number(order?.priorityDelivery ?? 0);
  const tip = Number(order?.tip ?? 0);
  const discount = Number(order?.discount ?? 0);
  const totalApp = Number(order?.totalApp ?? 0);

  return (
    <Box p={2}>
      {/* Breadcrumbs */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link to="/orders" style={{ textDecoration: 'none' }}>
          <Typography color="text.secondary">Órdenes</Typography>
        </Link>
        <Typography color="text.primary">Detalle</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        {loading ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="text" width={240} />
            <Skeleton variant="rectangular" width={120} height={28} />
          </Stack>
        ) : notFound ? (
          <Alert severity="warning">No se encontró la orden solicitada.</Alert>
        ) : (
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Avatar variant="rounded">
                <LocalMallIcon />
              </Avatar>
            </Grid>
            <Grid item xs={12} sm="auto">
              <Typography variant="h6" fontWeight={700}>
                Orden #{order?.numeroDeOrden ?? '—'}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <EstadoChip estadoText={order?.estadoText} estadoBool={order?.estadoBool} />
                <MetodoChip metodo={order?.metodoDePago} />
                <Chip
                  label={order?.nombreCiudad || '—'}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Grid>
            <Grid item xs />
            <Grid item>
              <Stack spacing={0.5} alignItems="flex-end">
                <Typography variant="body2" color="text.secondary">
                  Creada:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatDateTime(order?.createdAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ID doc: {order?.id}
                </Typography>
                {order?.idOrderText && (
                  <Typography variant="caption" color="text.secondary">
                    Payment UUID: {order?.idOrderText}
                  </Typography>
                )}
              </Stack>
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Top info cards */}
      <Grid container spacing={2}>
        {/* Negocio */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                <StorefrontIcon />
                <Typography variant="subtitle1" fontWeight={700}>
                  Negocio
                </Typography>
              </Stack>
              {loading ? (
                <>
                  <Skeleton width="60%" />
                  <Skeleton width="40%" />
                </>
              ) : (
                <Stack spacing={1}>
                  <Badge
                    label="Nombre"
                    value={order?.nombreEmpresa}
                    icon={<Avatar sx={{ width: 20, height: 20 }} src={order?.logoEmpresa} />}
                  />
                  <Badge label="UUID Empresa" value={order?.tiendaIdText} icon={<></>} />
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Cliente */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                <PersonIcon />
                <Typography variant="subtitle1" fontWeight={700}>
                  Cliente
                </Typography>
              </Stack>
              {loading ? (
                <>
                  <Skeleton width="70%" />
                  <Skeleton width="50%" />
                </>
              ) : (
                <Stack spacing={1}>
                  <Badge label="Nombre" value={order?.nameCliente} icon={<></>} />
                  <Badge label="Teléfono" value={order?.telefonoPrincipal} icon={<></>} />
                  {order?.discountCoupon && (
                    <Badge label="Cupón" value={order?.discountCoupon} icon={<></>} />
                  )}
                  {order?.conRTN && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        Facturación RTN
                      </Typography>
                      <Typography variant="body2">
                        {datosRTN?.nombreRTN || '—'}
                      </Typography>
                      <Typography variant="body2">
                        RTN: {datosRTN?.numeroRTN || '—'}
                      </Typography>
                      <Typography variant="body2">
                        Correo: {datosRTN?.correoElectronico || '—'}
                      </Typography>
                    </>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Entrega / Pago */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                <LocalShippingIcon />
                <Typography variant="subtitle1" fontWeight={700}>
                  Entrega & Pago
                </Typography>
              </Stack>
              {loading ? (
                <>
                  <Skeleton width="80%" />
                  <Skeleton width="60%" />
                </>
              ) : (
                <Stack spacing={1}>
                  <Badge label="Entrega" value={order?.formaDeEntrega} icon={<></>} />
                  <Badge label="Método de pago" value={order?.metodoDePago} icon={<CreditCardIcon fontSize="small" />} />
                  {order?.tarjetaUsada && (
                    <Typography variant="body2">
                      Tarjeta: **** **** **** {order?.tarjetaUsada}
                    </Typography>
                  )}
                  {order?.conEntregaPrioritaria && (
                    <Chip size="small" color="warning" label="Entrega prioritaria" />
                  )}
                  {order?.note && (
                    <Typography variant="body2">
                      <strong>Nota:</strong> {order?.note}
                    </Typography>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dirección */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Dirección de {order?.formaDeEntrega === 'Domicilio' ? 'envío' : 'recogido'}
        </Typography>
        {loading ? (
          <>
            <Skeleton width="40%" />
            <Skeleton width="70%" />
            <Skeleton width="50%" />
          </>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  <strong>Alias:</strong> {shippingAddress?.alias || '—'}
                </Typography>
                <Typography variant="body2">
                  <strong>Ciudad:</strong> {shippingAddress?.ciudad || order?.nombreCiudad || '—'}
                </Typography>
                <Typography variant="body2">
                  <strong>Dirección:</strong> {shippingAddress?.fullAddress || '—'}
                </Typography>
                {shippingAddress?.colonia && (
                  <Typography variant="body2">
                    <strong>Colonia:</strong> {shippingAddress?.colonia}
                  </Typography>
                )}
                {shippingAddress?.telefono && (
                  <Typography variant="body2">
                    <strong>Teléfono:</strong> {shippingAddress?.telefono}
                  </Typography>
                )}
              </Stack>
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Items */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            Ítems del pedido
          </Typography>
          <Chip size="small" label={`${items.length} ítem(s)`} />
        </Stack>

        {loading ? (
          <Skeleton variant="rectangular" height={180} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
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
                    <TableCell>{it?.cantidad ?? 1}</TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" fontWeight={600}>
                          {it?.nombreProducto || '—'}
                        </Typography>
                        {/* Modificadores */}
                        {!!(it?.modificadoresSeleccionados?.length) && (
                          <Typography variant="caption" color="text.secondary">
                            Modificadores: {it.modificadoresSeleccionados.map((m) => m?.nombre || m).join(', ')}
                          </Typography>
                        )}
                        {/* Extras */}
                        {!!(it?.extrasSeleccionados?.length) && (
                          <Typography variant="caption" color="text.secondary">
                            Extras: {it.extrasSeleccionados.map((e) => e?.nombre || e).join(', ')}
                          </Typography>
                        )}
                        {it?.notasItem && (
                          <Typography variant="caption" color="text.secondary">
                            Nota: {it.notasItem}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{currency(it?.precioUnitarioCalculadoApp ?? 0)}</TableCell>
                    <TableCell>{currency(it?.subtotalItemCalculadoApp ?? 0)}</TableCell>
                    <TableCell align="right">
                      {currency(it?.precioUnitarioCalculadoTienda ?? 0)}
                    </TableCell>
                    <TableCell align="right">
                      {currency(it?.subtotalItemCalculadoTienda ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No hay ítems en este pedido.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Totales */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Grid container>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Resumen de pago
            </Typography>
            {loading ? (
              <Skeleton variant="rectangular" height={120} />
            ) : (
              <Stack spacing={0.75} maxWidth={420}>
                <RowAmount label="Subtotal" value={currency(subTotal)} />
                <RowAmount label="Envío" value={currency(shipping)} />
                <RowAmount label="Service fee" value={currency(serviceFee)} />
                {order?.conEntregaPrioritaria && (
                  <RowAmount label="Entrega prioritaria" value={currency(priorityDelivery)} />
                )}
                {tip > 0 && <RowAmount label="Propina" value={currency(tip)} />}
                {discount > 0 && (
                  <RowAmount
                    label="Descuento"
                    value={`- ${currency(discount)}`}
                    valueColor="error.main"
                  />
                )}
                <Divider sx={{ my: 1 }} />
                <RowAmount label="Total" value={currency(totalApp)} strong />
              </Stack>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Estado filtros (chips) */}
      {!loading && (order?.estadoFiltros?.length > 0) && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Filtros de estado
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {order.estadoFiltros.map((e, i) => (
              <Chip key={`${e}-${i}`} size="small" label={String(e)} />
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

function RowAmount({ label, value, strong = false, valueColor }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={strong ? 800 : 600}
        color={valueColor}
      >
        {value}
      </Typography>
    </Stack>
  );
}